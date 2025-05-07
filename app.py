from flask import Flask, render_template, request, jsonify
from docx import Document
import google.generativeai as genai
import os
import logging
from functools import lru_cache
import time
from dotenv import load_dotenv
import requests
from werkzeug.utils import secure_filename
import tempfile
import PyPDF2
import numpy as np
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import faiss
from sentence_transformers import SentenceTransformer

# Загрузка переменных окружения из .env файла
load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # Ограничение 5 МБ

# Глобальные переменные для векторного поиска
embedding_model = None

# Проверка наличия API ключа
api_key = os.getenv("GEMINI_API_KEY")
model_name = os.getenv("GEMINI_MODEL", "models/gemini-2.5-flash-preview-04-17")  # По умолчанию 2.5-flash

if not api_key:
    logger.error("API ключ для Gemini не найден в переменных окружения")
    print("Ошибка: Установите переменную среды GEMINI_API_KEY")
else:
    # Настройка Gemini API
    genai.configure(api_key=api_key)
    try:
        logger.info(f"Инициализация модели {model_name}")
        model = genai.GenerativeModel(model_name)
    except Exception as e:
        logger.error(f"Ошибка инициализации модели {model_name}: {str(e)}")
        logger.warning("Использую запасную модель models/gemini-2.0-flash")
        model = genai.GenerativeModel("models/gemini-2.0-flash")

# Инициализация модели эмбеддингов
def init_embedding_model():
    global embedding_model
    if embedding_model is None:
        try:
            logger.info("Инициализация модели эмбеддингов...")
           # embedding_model = SentenceTransformer('sentence-transformers/multi-qa-MiniLM-L6-cos-v1')
            embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("Модель эмбеддингов успешно загружена")
        except Exception as e:
            logger.error(f"Ошибка при загрузке модели эмбеддингов: {str(e)}")
            embedding_model = None

# Функции для работы с разными форматами файлов
@lru_cache(maxsize=1)
def load_docx_content(filename: str) -> str:
    try:
        doc = Document(filename)
        content = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
        logger.info(f"Документ .docx {filename} успешно загружен ({len(content)} байт)")
        return content
    except Exception as e:
        logger.error(f"Ошибка загрузки документа .docx {filename}: {str(e)}")
        return ""

def load_pdf_content(filename: str) -> str:
    try:
        text = ""
        with open(filename, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text += page.extract_text() + "\n"
        
        logger.info(f"Документ PDF {filename} успешно загружен ({len(text)} байт)")
        return text
    except Exception as e:
        logger.error(f"Ошибка загрузки PDF {filename}: {str(e)}")
        return ""

def load_txt_content(filename: str) -> str:
    try:
        with open(filename, 'r', encoding='utf-8') as file:
            text = file.read()
        logger.info(f"Документ TXT {filename} успешно загружен ({len(text)} байт)")
        return text
    except UnicodeDecodeError:
        try:
            # Повторная попытка с другой кодировкой
            with open(filename, 'r', encoding='latin-1') as file:
                text = file.read()
            logger.info(f"Документ TXT {filename} успешно загружен с кодировкой latin-1 ({len(text)} байт)")
            return text
        except Exception as e:
            logger.error(f"Ошибка загрузки TXT {filename}: {str(e)}")
            return ""
    except Exception as e:
        logger.error(f"Ошибка загрузки TXT {filename}: {str(e)}")
        return ""

# Функция для загрузки текста с URL
def load_from_url(url: str) -> tuple:
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        logger.info(f"Документация успешно загружена с URL: {url} ({len(response.text)} байт)")
        return response.text, None
    except requests.exceptions.HTTPError as e:
        error_msg = f"HTTP ошибка: {e.response.status_code}"
        if e.response.status_code == 404:
            error_msg = "Страница не найдена (404)"
        elif e.response.status_code == 403:
            error_msg = "Доступ запрещен (403)"
        elif e.response.status_code == 429:
            error_msg = "Слишком много запросов (429). Повторите позже"
        elif e.response.status_code >= 500:
            error_msg = f"Ошибка сервера ({e.response.status_code})"
        logger.error(f"Ошибка загрузки с URL {url}: {error_msg}")
        return "", error_msg
    except requests.exceptions.ConnectionError:
        error_msg = "Ошибка соединения. Проверьте доступность ресурса."
        logger.error(f"Ошибка загрузки с URL {url}: {error_msg}")
        return "", error_msg
    except requests.exceptions.Timeout:
        error_msg = "Превышено время ожидания запроса."
        logger.error(f"Ошибка загрузки с URL {url}: {error_msg}")
        return "", error_msg
    except requests.exceptions.RequestException as e:
        error_msg = f"Ошибка запроса: {str(e)}"
        logger.error(f"Ошибка загрузки с URL {url}: {error_msg}")
        return "", error_msg

# Функция для разбиения текста на фрагменты
def split_text_into_chunks(text: str, chunk_size: int = 2000, chunk_overlap: int = 200) -> list:
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
    )
    chunks = text_splitter.split_text(text)
    logger.info(f"Документ разбит на {len(chunks)} фрагментов")
    return chunks

# Функция для векторного поиска с использованием FAISS
def vector_search(query: str, chunks: list, top_k: int = 5):
    if embedding_model is None:
        init_embedding_model()
        if embedding_model is None:
            return chunks[:top_k]  # Возвращаем первые несколько чанков, если модель не загружена
    
    try:
        # Создаем векторные представления для чанков
        chunk_embeddings = embedding_model.encode(chunks)
        
        # Создаем индекс FAISS
        index_dim = chunk_embeddings.shape[1]
        index = faiss.IndexFlatL2(index_dim)
        index.add(np.array(chunk_embeddings).astype('float32'))
        
        # Получаем эмбеддинг запроса
        query_embedding = embedding_model.encode([query])
        
        # Ищем похожие чанки
        distances, indices = index.search(np.array(query_embedding).astype('float32'), min(top_k, len(chunks)))
        
        # Возвращаем найденные чанки
        retrieved_chunks = [chunks[idx] for idx in indices[0]]
        logger.info(f"Найдено {len(retrieved_chunks)} релевантных фрагментов из {len(chunks)}")
        return retrieved_chunks, {"used_chunks": len(retrieved_chunks), "total_chunks": len(chunks)}
    except Exception as e:
        logger.error(f"Ошибка при векторном поиске: {str(e)}")
        return chunks[:top_k], {"used_chunks": min(top_k, len(chunks)), "total_chunks": len(chunks)}

# Более простой поиск с использованием TF-IDF
def simple_semantic_search(query: str, chunks: list, top_k: int = 5):
    try:
        # Создаем TF-IDF векторайзер
        vectorizer = TfidfVectorizer(stop_words='english')
        
        # Получаем TF-IDF матрицу для чанков
        tfidf_matrix = vectorizer.fit_transform(chunks + [query])
        
        # Вычисляем схожесть между запросом и чанками
        cosine_similarities = cosine_similarity(tfidf_matrix[-1:], tfidf_matrix[:-1]).flatten()
        
        # Находим индексы наиболее схожих чанков
        most_similar_indices = cosine_similarities.argsort()[-(min(top_k, len(chunks))):][::-1]
        
        # Возвращаем наиболее релевантные чанки
        retrieved_chunks = [chunks[idx] for idx in most_similar_indices]
        logger.info(f"Найдено {len(retrieved_chunks)} релевантных фрагментов из {len(chunks)}")
        return retrieved_chunks, {"used_chunks": len(retrieved_chunks), "total_chunks": len(chunks)}
    except Exception as e:
        logger.error(f"Ошибка при TF-IDF поиске: {str(e)}")
        return chunks[:top_k], {"used_chunks": min(top_k, len(chunks)), "total_chunks": len(chunks)}

# Функция для определения типа файла и загрузки контента
def load_document_content(file_path: str) -> tuple:
    file_extension = os.path.splitext(file_path)[1].lower()
    
    if file_extension == '.docx':
        try:
            content = load_docx_content(file_path)
            if not content:
                return "", "Файл DOCX пуст или имеет некорректный формат"
            return content, None
        except Exception as e:
            error_msg = f"Ошибка чтения DOCX файла: {str(e)}"
            logger.error(error_msg)
            return "", error_msg
    elif file_extension == '.pdf':
        try:
            content = load_pdf_content(file_path)
            if not content:
                return "", "PDF файл пуст или не содержит текстовых данных"
            return content, None
        except Exception as e:
            error_msg = f"Ошибка чтения PDF файла: {str(e)}"
            logger.error(error_msg)
            return "", error_msg
    elif file_extension == '.txt':
        try:
            content = load_txt_content(file_path)
            if not content:
                return "", "Текстовый файл пуст"
            return content, None
        except Exception as e:
            error_msg = f"Ошибка чтения текстового файла: {str(e)}"
            logger.error(error_msg)
            return "", error_msg
    else:
        error_msg = f"Неподдерживаемое расширение файла: {file_extension}"
        logger.error(error_msg)
        return "", error_msg

# Загружаем данные по умолчанию при запуске
try:
    default_doc_context = load_docx_content("d.docx")
    if not default_doc_context:
        logger.warning("Документ по умолчанию пуст или не удалось его загрузить")
except Exception as e:
    logger.error(f"Ошибка при инициализации документа по умолчанию: {str(e)}")
    default_doc_context = ""

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/ask", methods=["POST"])
def ask():
    if not api_key:
        return jsonify({"error": "API ключ не настроен"}), 500
        
    start_time = time.time()
    
    # Получаем данные из запроса
    question = request.form.get("question", "").strip()
    url = request.form.get("url", "").strip()
    uploaded_file = request.files.get("file")
    
    # Параметры обработки
    advanced_processing = request.form.get("advanced_processing", "false").lower() == "true"
    chunk_size = int(request.form.get("chunk_size", "2000"))
    
    if not question:
        return jsonify({"error": "Вопрос не может быть пустым"}), 400
    
    logger.info(f"Получен вопрос: {question[:50]}{'...' if len(question) > 50 else ''}")
    logger.info(f"Режим обработки: {'Расширенный' if advanced_processing else 'Стандартный'}")
    
    # Выбираем источник документации по приоритету
    doc_context = default_doc_context
    source_info = "d.docx (по умолчанию)"
    chunks_info = None
    source_error = None
    
    # Обработка загруженного файла (приоритет 1)
    if uploaded_file and uploaded_file.filename:
        try:
            file_extension = os.path.splitext(uploaded_file.filename)[1].lower()
            if file_extension not in ['.docx', '.pdf', '.txt']:
                return jsonify({"error": "Поддерживаются только файлы .docx, .pdf и .txt"}), 400
                
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_extension)
            uploaded_file.save(temp_file.name)
            
            # Загружаем содержимое файла в зависимости от его типа
            file_content, file_error = load_document_content(temp_file.name)
            
            # Удаляем временный файл
            temp_file.close()
            os.unlink(temp_file.name)
            
            if file_error:
                source_error = f"Ошибка при обработке файла {uploaded_file.filename}: {file_error}"
                logger.warning(source_error)
            elif not file_content:
                source_error = f"Файл {uploaded_file.filename} не содержит текстовых данных"
                logger.warning(source_error)
            else:
                doc_context = file_content
                source_info = f"загруженный файл {uploaded_file.filename}"
        except Exception as e:
            logger.error(f"Ошибка обработки файла: {str(e)}")
            return jsonify({"error": f"Ошибка обработки файла: {str(e)}"}), 500
    
    # Обработка URL (приоритет 2)
    elif url:
        url_content, url_error = load_from_url(url)
        if url_error:
            source_error = f"Не удалось загрузить документацию с URL: {url_error}"
            logger.warning(f"Не удалось загрузить данные с URL: {url}. Причина: {url_error}")
        elif url_content:
            doc_context = url_content
            source_info = f"URL: {url}"
        else:
            source_error = f"URL {url} не содержит текстовых данных"
            logger.warning(source_error)
    
    logger.info(f"Используется источник документации: {source_info}")
    
    # Применяем обработку текста в зависимости от выбранного режима
    if advanced_processing and doc_context:
        try:
            # Разбиваем текст на части
            chunks = split_text_into_chunks(doc_context, chunk_size=chunk_size)
            
            # Если документ действительно большой, используем векторный поиск
            if len(chunks) > 10:
                relevant_chunks, chunks_info = vector_search(question, chunks, top_k=5)
            else:
                # Для небольших документов используем более простой TF-IDF поиск
                relevant_chunks, chunks_info = simple_semantic_search(question, chunks, top_k=3)
            
            # Объединяем найденные части для контекста
            doc_context = "\n\n".join(relevant_chunks)
            logger.info(f"Применена семантическая обработка: {len(relevant_chunks)} фрагментов из {len(chunks)}")
        except Exception as e:
            logger.error(f"Ошибка при обработке текста: {str(e)}")
            # В случае ошибки используем полный текст
    
    # Формируем промпт для модели
    prompt = f'''Ты — универсальный помощник. Используй приведённую ниже документацию для ответов.
Если ответа на вопрос нет в документации, честно скажи что не знаешь.

Документация:
{doc_context}

Вопрос: {question}
Ответ в формате Markdown (используй списки, заголовки, кодовые блоки и т.д.):'''

    try:
        # Запрос к API Gemini
        response = model.generate_content(prompt)
        response_text = response.text
        
        # Логируем время ответа
        elapsed_time = time.time() - start_time
        logger.info(f"Ответ получен за {elapsed_time:.2f} секунд")
        
        # Формируем JSON-ответ
        result = {"answer": response_text}
        
        # Добавляем информацию о фрагментах, если доступна
        if chunks_info:
            result["chunks_info"] = chunks_info
        
        # Добавляем информацию об ошибке источника, если есть
        if source_error:
            result["source_error"] = source_error
        
        return jsonify(result)
    except Exception as e:
        logger.error(f"Ошибка при получении ответа от API: {str(e)}")
        return jsonify({"error": f"Не удалось получить ответ: {str(e)}"}), 500

@app.errorhandler(404)
def page_not_found(e):
    return jsonify({"error": "Страница не найдена"}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Внутренняя ошибка сервера"}), 500

@app.errorhandler(413)
def request_entity_too_large(e):
    return jsonify({"error": "Размер файла превышает 5 МБ"}), 413

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)