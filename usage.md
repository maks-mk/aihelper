# Руководство по использованию Universal AI Helper

## Быстрый старт

1. Введите ваш вопрос в верхнее текстовое поле.
2. (Необязательно) Загрузите файл документации (`.docx`, `.pdf`, `.txt`) или укажите URL документации.
3. (Необязательно) Для больших файлов включите "Расширенную обработку" и выберите размер фрагментов.
4. Нажмите "Спросить" или используйте Ctrl+Enter.
5. Ответ появится в правой панели, с форматированием Markdown и подсветкой кода.

---

## Интерфейс

### Десктопная версия
- **Двухпанельный интерфейс**:
  - **Левая панель (1/2 экрана)**: форма ввода вопроса, настройки, примеры вопросов
  - **Правая панель (1/2 экрана)**: отображение результатов с заголовком
- Удобно работать с документацией, когда форма запроса и результаты видны одновременно
- Адаптивный дизайн обеспечивает оптимальное отображение на различных разрешениях (1366x768, 1920x1080)
- Блок "Частые вопросы" всегда отображается в одну строку для удобства использования
- Информативные подсказки появляются при наведении курсора на кнопки и элементы управления

### Мобильная версия
- **Однопанельный интерфейс** (адаптивный)
- Панели отображаются последовательно, одна под другой
- Оптимизировано для удобства использования на сенсорных экранах
- Подсказки доступны при длительном нажатии на элементы интерфейса

---

## Поддерживаемые форматы файлов
- **.docx** — Microsoft Word
- **.pdf** — PDF-документы (только текстовые страницы)
- **.txt** — обычный текст

Максимальный размер файла: **5 МБ**

---

## Источники данных (приоритет)
1. **Загруженный файл** (docx/pdf/txt)
2. **URL** (будет скачан и проанализирован текст страницы, если файл не выбран)
3. **data.docx** (файл по умолчанию в корне проекта)

> **Важно:** Если указаны одновременно и файл, и URL — будет обработан только файл, а URL проигнорируется.

---

## Режимы обработки

### Стандартный режим
- Используется для небольших документов.
- Весь текст документа отправляется в модель целиком.
- Быстро, подходит для кратких инструкций, справок, небольших статей.

### Расширенная обработка
- Рекомендуется для больших документов (от 50 000 символов или >1 МБ).
- Документ разбивается на фрагменты (чанки) выбранного размера.
- Для поиска ответа используется семантический/векторный поиск:
  - **FAISS + Sentence Transformers** — для больших документов
  - **TF-IDF** — для небольших
- В ответе отображается, сколько фрагментов было использовано.

#### Как выбрать размер чанка?
- **1000 символов** — для очень структурированных или коротких абзацев
- **2000 символов** — универсальный вариант (по умолчанию)
- **4000 символов** — для длинных статей, справочников, технических мануалов

---

## Примеры вопросов
- Как создать образ Docker?
- Какой синтаксис у команды ... в моей документации?
- Как настроить сервис в предоставленном .docx?
- Как использовать функцию, описанную по ссылке?
- Какой параметр отвечает за ... в PDF?

---

## Обработка ошибок
- **Некорректный URL**: если введенный URL недействителен или недоступен, вы увидите предупреждение и система будет использовать документацию по умолчанию
- **Проблемы с файлом**: если файл не может быть обработан (поврежден или неподдерживаемый формат), система отобразит соответствующее предупреждение
- **Превышение размера файла**: файлы размером более 5 МБ не будут обработаны, о чем система сообщит пользователю

---

## Рекомендации
- Для максимально точных ответов используйте расширенную обработку для больших файлов.
- Если документ содержит много таблиц/картинок (особенно PDF), результат может быть ограничен только текстовой частью.
- Для сложных технических вопросов лучше использовать документацию в виде .docx или .txt.
- Если ответ не найден — попробуйте переформулировать вопрос или загрузить более релевантный файл.

---

## Ограничения
- Только текстовые данные (PDF с картинками/сканами не поддерживаются)
- Максимальный размер файла — 5 МБ
- Ответ формируется на основе предоставленного контекста, не ищет в интернете

---

## Вопросы и поддержка
- Для обратной связи и багрепортов используйте GitHub Issues проекта. 