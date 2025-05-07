// Определение мобильного устройства
const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Определение iOS устройств
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Настройка Marked и highlight.js
document.addEventListener('DOMContentLoaded', function() {
  // Добавляем классы для определения типа устройства
  if (IS_MOBILE) {
    document.body.classList.add('mobileDevice');
    
    // Особые настройки для iOS
    if (IS_IOS) {
      document.body.classList.add('ios-device');
      fixIOSInputs();
    }
  }
  
  // Инициализация FastClick для устранения задержки нажатия на мобильных
  if (typeof FastClick !== 'undefined' && IS_MOBILE) {
    FastClick.attach(document.body);
    console.log('FastClick активирован');
  }
  
  // Инициализация highlight.js и marked.js
  if (typeof hljs !== 'undefined' && typeof marked !== 'undefined') {
    console.log('Настройка marked и highlight.js');
    
    try {
      // Создаем конфигурацию для marked
      const markedOptions = {
        gfm: true,          // GitHub Flavored Markdown
        breaks: true,       // переносы строк как <br>
        headerIds: true,    // IDs для заголовков
        langPrefix: 'hljs language-',  // префикс CSS-классов для блоков кода
        pedantic: false,    // соответствие спецификации markdown
        mangle: false       // не обрабатывать ссылки на email
      };

      // Настраиваем highlight функцию
      const renderer = new marked.Renderer();
      
      // Улучшенная обработка блоков кода
      renderer.code = function(code, language) {
        // Если язык не указан или некорректный, используем текст
        const langClass = language && hljs.getLanguage(language) ? language : '';
        const displayLang = langClass || 'текст';
        
        let highlightedCode;
        try {
          if (langClass) {
            // Если язык определен, используем соответствующую подсветку
            highlightedCode = hljs.highlight(code, { language: langClass }).value;
          } else {
            // Если язык не определен, пытаемся определить автоматически
            highlightedCode = hljs.highlightAuto(code).value;
          }
        } catch (e) {
          console.warn('Ошибка подсветки кода:', e);
          highlightedCode = code; // В случае ошибки возвращаем исходный код
        }
        
        // Возвращаем HTML с подсвеченным кодом, обернутым в pre и code
        return `<pre data-lang="${displayLang}"><code class="hljs language-${langClass}">${highlightedCode}</code></pre>`;
      };
      
      // Настраиваем безопасный рендеринг ссылок
      renderer.link = function(href, title, text) {
        const link = marked.Renderer.prototype.link.call(this, href, title, text);
        return link.replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" ');
      };
      
      // Применяем настройки
      marked.setOptions({
        renderer: renderer,
        ...markedOptions,
        highlight: function(code, lang) {
          try {
            if (lang && hljs.getLanguage(lang)) {
              return hljs.highlight(code, { language: lang }).value;
            } else {
              return hljs.highlightAuto(code).value;
            }
          } catch (e) {
            console.warn('Ошибка highlight в marked.setOptions:', e);
            return code;
          }
        }
      });
      
      console.log('marked.js настроен успешно');
    } catch (e) {
      console.error('Ошибка при настройке marked.js:', e);
    }
  } else {
    console.warn('highlight.js или marked.js не загружены');
  }
  
  // Автофокус на текстовое поле только на десктопе
  if (!IS_MOBILE) {
    document.getElementById('question').focus();
  }
  
  // Добавляем обработчик клавиши Enter при нажатии Ctrl
  document.getElementById('question').addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'Enter') {
      sendQuestion();
    }
  });
  
  // Инициализация темы
  initializeTheme();
  
  // Основные обработчики событий
  setupEventHandlers();
  
  // Обработчик загрузки файла
  const fileInput = document.getElementById('docFile');
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      const fileNameSpan = document.getElementById('fileName');
      const fileLabel = document.querySelector('.file-label');
      
      if (this.files && this.files[0]) {
        // Получаем данные о файле
        const fileName = this.files[0].name;
        const fileExt = fileName.split('.').pop().toLowerCase();
        
        // Проверяем расширение файла
        const validExtensions = ['docx', 'pdf', 'txt'];
        
        // Проверяем размер файла (максимум 5 МБ)
        const maxSize = 5 * 1024 * 1024; // 5 МБ
        
        if (!validExtensions.includes(fileExt)) {
          alert('Поддерживаются только файлы .docx, .pdf и .txt');
          this.value = '';
          fileNameSpan.textContent = 'Файл';
          fileLabel.classList.remove('has-file');
          return;
        }
        
        if (this.files[0].size > maxSize) {
          alert('Размер файла не должен превышать 5 МБ');
          this.value = '';
          fileNameSpan.textContent = 'Файл';
          fileLabel.classList.remove('has-file');
          return;
        }
        
        // Если файл крупный (больше 1MB), рекомендуем расширенный режим
        if (this.files[0].size > 1024 * 1024) {
          const advancedProcessingToggle = document.getElementById('advancedProcessing');
          if (!advancedProcessingToggle.checked) {
            if (confirm('Файл довольно большой. Включить расширенную обработку для улучшения ответов?')) {
              advancedProcessingToggle.checked = true;
              toggleAdvancedProcessing();
            }
          }
        }
        
        // Сокращаем имя файла если оно слишком длинное
        let displayName = fileName;
        if (displayName.length > 15) {
          displayName = displayName.substring(0, 12) + '...';
        }
        
        fileNameSpan.textContent = displayName;
        fileLabel.classList.add('has-file');
        
        // Добавляем иконку в зависимости от типа файла
        const fileIcon = fileLabel.querySelector('i');
        if (fileExt === 'pdf') {
          fileIcon.className = 'bi bi-file-earmark-pdf';
        } else if (fileExt === 'txt') {
          fileIcon.className = 'bi bi-file-earmark-text';
        } else if (fileExt === 'docx') {
          fileIcon.className = 'bi bi-file-earmark-word';
        }
        
      } else {
        fileNameSpan.textContent = 'Файл';
        fileLabel.classList.remove('has-file');
        fileLabel.querySelector('i').className = 'bi bi-file-earmark-text';
      }
    });
  }
});

// Настройки темы
const DARK_THEME = 'dark';
const LIGHT_THEME = 'light';
const THEME_STORAGE_KEY = 'preferred-theme';
const HIGHLIGHT_DARK = 'https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/styles/github-dark.min.css';
const HIGHLIGHT_LIGHT = 'https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/styles/github.min.css';

// Инициализация темы на основе сохраненных предпочтений или системных настроек
function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  
  if (savedTheme) {
    setTheme(savedTheme);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    setTheme(DARK_THEME);
  }
  
  // Обновляем иконки для текущей темы
  updateThemeIcons();
}

// Переключение между темной и светлой темой
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || LIGHT_THEME;
  const newTheme = currentTheme === LIGHT_THEME ? DARK_THEME : LIGHT_THEME;
  
  setTheme(newTheme);
  localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  
  // Добавляем эффект пульсации при переключении темы
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.classList.add('pulse-effect');
  setTimeout(() => {
    themeToggle.classList.remove('pulse-effect');
  }, 500);
}

// Установка темы
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  
  // Меняем стиль для highlight.js
  const highlightThemeLink = document.getElementById('highlight-theme');
  highlightThemeLink.href = theme === DARK_THEME ? HIGHLIGHT_DARK : HIGHLIGHT_LIGHT;
  
  // Обновляем иконки
  updateThemeIcons();
}

// Обновление иконок темы
function updateThemeIcons() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || LIGHT_THEME;
  const lightIcon = document.getElementById('light-icon');
  const darkIcon = document.getElementById('dark-icon');
  
  if (currentTheme === DARK_THEME) {
    lightIcon.style.display = 'none';
    darkIcon.style.display = 'inline-block';
  } else {
    lightIcon.style.display = 'inline-block';
    darkIcon.style.display = 'none';
  }
}

// Установка вопроса из примеров
function setQuestion(text) {
  document.getElementById('question').value = text;
  document.getElementById('question').focus();
  return false;
}

// Применение подсветки синтаксиса к блоку кода
function applyHighlight() {
  console.log('Применение подсветки к блокам кода');
  if (typeof hljs !== 'undefined') {
    try {
      // Инициализация автоматической подсветки для всего документа
      hljs.configure({ 
        ignoreUnescapedHTML: true,
        languages: ['javascript', 'python', 'bash', 'xml', 'dockerfile', 'yaml', 'json', 'css', 'sql'] 
      });
      
      // Сначала применим глобальную подсветку
      hljs.highlightAll();
      
      // Затем найдем все блоки кода и применим подсветку вручную для каждого отдельно
      document.querySelectorAll('pre code').forEach(function(block) {
        console.log('Обработка блока кода:', block.className);
        
        // Если блок еще не подсвечен, подсветим его
        if (!block.classList.contains('hljs')) {
          try {
            // Определяем язык из класса
            const langMatch = block.className.match(/language-(\w+)/);
            const language = langMatch ? langMatch[1] : '';
            
            // Если язык распознан, используем его, иначе авто-определение
            if (language && hljs.getLanguage(language)) {
              hljs.highlightElement(block);
            } else {
              hljs.highlightAuto(block);
            }
          } catch (e) {
            console.error('Ошибка подсветки отдельного блока:', e);
          }
        }
        
        // Добавляем атрибут data-lang к родительскому pre если он еще не установлен
        const preElement = block.parentNode;
        if (preElement && preElement.tagName === 'PRE' && !preElement.hasAttribute('data-lang')) {
          // Получаем язык из класса
          const langMatch = block.className.match(/language-(\w+)/);
          const language = langMatch ? langMatch[1] : 'текст';
          preElement.setAttribute('data-lang', language);
        }
      });
    } catch (e) {
      console.error('Ошибка при применении подсветки:', e);
    }
  } else {
    console.warn('highlight.js не доступен для подсветки');
  }
}

// Обработка прокрутки для стики-хедера
function setupScrollHandling() {
  if (window.matchMedia('(max-width: 576px)').matches) {
    const header = document.querySelector('header');
    let lastScrollTop = 0;
    
    window.addEventListener('scroll', function() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      // Если прокрутили больше 50px вниз
      if (scrollTop > 50 && scrollTop > lastScrollTop) {
        // Прокрутка вниз - скрываем хедер
        header.style.transform = 'translateY(-100%)';
        header.style.transition = 'transform 0.3s';
      } else if (scrollTop < lastScrollTop) {
        // Прокрутка вверх - показываем хедер
        header.style.transform = 'translateY(0)';
        header.style.transition = 'transform 0.3s';
        
        if (scrollTop <= 50) {
          // Вернулись к началу - убираем стики
          header.classList.remove('sticky');
          header.style.transition = '';
          header.style.transform = '';
        } else {
          // Стики хедер при прокрутке вверх
          header.classList.add('sticky');
        }
      }
      
      lastScrollTop = scrollTop;
    });
  }
}

// Настройка для мобильных устройств
function setupMobileUI() {
  // Обработка текстового поля при фокусе на мобильных устройствах
  if (IS_MOBILE) {
    const questionTextarea = document.getElementById('question');
    const header = document.querySelector('header');
    
    // При фокусе на текстовом поле скрываем шапку для экономии места
    questionTextarea.addEventListener('focus', function() {
      header.style.display = 'none';
    });
    
    // При потере фокуса возвращаем шапку
    questionTextarea.addEventListener('blur', function() {
      // Небольшая задержка перед показом шапки, чтобы не мешать переключению темы
      setTimeout(() => {
        header.style.display = 'block';
      }, 100);
    });
    
    // Обрабатываем ориентацию экрана
    window.addEventListener('orientationchange', function() {
      setTimeout(() => {
        window.scrollTo(0, 0);
        adjustUIForScreenSize();
      }, 100);
    });
    
    // Оптимизация текста кнопок для малых экранов
    adjustUIForScreenSize();
    
    // Исправляем проблему с нажатиями на кнопки в мобильной версии
    addTouchSupportForButtons();
  }
  
  // Предотвращаем масштабирование на двойное нажатие (для iOS)
  document.addEventListener('touchend', function(event) {
    if (event.target.tagName === 'BUTTON' || event.target.closest('button')) {
      event.preventDefault();
    }
  });
  
  // Добавляем обработку плавной прокрутки при клике на кнопки-примеры
  const exampleButtons = document.querySelectorAll('.example-link');
  exampleButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Прокручиваем к форме ввода
      setTimeout(() => {
        document.getElementById('question').scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
  });
}

// Проверка, является ли устройство тач-устройством
function isTouchDevice() {
  return (('ontouchstart' in window) ||
     (navigator.maxTouchPoints > 0) ||
     (navigator.msMaxTouchPoints > 0));
}

// Добавление специальных обработчиков для тач-устройств
function addTouchSupportForButtons() {
  if (!isTouchDevice()) return;
  
  // Добавляем специальный класс для body, чтобы применять CSS для тач-устройств
  document.body.classList.add('touch-device');
  
  // Обработка нажатий на кнопку "Спросить"
  const askButton = document.getElementById('askButton');
  if (askButton) {
    // Заменяем preventDefault() на метод с явным обработчиком клика
    askButton.addEventListener('touchend', function(e) {
      e.preventDefault();
      sendQuestion();
    }, { passive: false });
  }
  
  // Обработка нажатий на кнопки примеров
  const exampleButtons = document.querySelectorAll('.example-link');
  exampleButtons.forEach(button => {
    // Заменяем preventDefault() на метод с явным обработчиком клика
    button.addEventListener('touchend', function(e) {
      e.preventDefault();
      const questionText = this.getAttribute('data-question');
      if (questionText) {
        setQuestion(questionText);
      }
    }, { passive: false });
  });
  
  // Обработка нажатий на кнопку сброса
  const resetButton = document.getElementById('reset-button');
  if (resetButton) {
    resetButton.addEventListener('touchend', function(e) {
      e.preventDefault();
      resetForm();
    }, { passive: false });
  }
  
  // Обработка нажатий на кнопку переключения темы
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('touchend', function(e) {
      e.preventDefault();
      toggleTheme();
    }, { passive: false });
  }
}

// Регулировка UI в зависимости от размера экрана
function adjustUIForScreenSize() {
  const verySmallScreen = window.innerWidth < 350;
  const buttonText = document.querySelector('.btn-text');
  
  // Если экран очень маленький, упрощаем текст кнопки
  if (buttonText && verySmallScreen) {
    buttonText.textContent = '';
  } else if (buttonText) {
    buttonText.textContent = 'Спросить';
  }
}

// Показ затемнения при загрузке (только на мобильных)
function showMobileOverlay() {
  if (IS_MOBILE) {
    const overlay = document.createElement('div');
    overlay.className = 'mobile-overlay';
    overlay.innerHTML = '<div class="loader"><i class="bi bi-arrow-repeat spin"></i></div>';
    document.body.appendChild(overlay);
    return overlay;
  }
  return null;
}

// Удаление затемнения
function removeMobileOverlay(overlay) {
  if (overlay) {
    overlay.classList.add('fade-out');
    setTimeout(() => {
      overlay.remove();
    }, 300);
  }
}

// Обработчик переключателя расширенной обработки
const advancedProcessingToggle = document.getElementById('advancedProcessing');
const chunkSizeSelect = document.getElementById('chunkSize');

if (advancedProcessingToggle) {
  advancedProcessingToggle.addEventListener('change', toggleAdvancedProcessing);
}

function toggleAdvancedProcessing() {
  if (advancedProcessingToggle.checked) {
    chunkSizeSelect.disabled = false;
  } else {
    chunkSizeSelect.disabled = true;
  }
}

// Обновленная функция отправки вопроса с поддержкой расширенной обработки
async function sendQuestion() {
  // Проверяем, было ли событие вызвано программно (многократные вызовы)
  if (window.preventMultipleSubmit) {
    console.log('Предотвращение множественной отправки');
    return;
  }
  
  window.preventMultipleSubmit = true;
  setTimeout(() => { window.preventMultipleSubmit = false; }, 500);
  
  const questionElement = document.getElementById("question");
  const question = questionElement.value.trim();
  const responseDiv = document.getElementById("answer");
  const askButton = document.getElementById("askButton");
  const docUrlElement = document.getElementById("docUrl");
  const fileInput = document.getElementById("docFile");
  const advancedProcessing = document.getElementById("advancedProcessing").checked;
  const chunkSize = document.getElementById("chunkSize").value;
  
  if (!question) {
    responseDiv.innerHTML = "Пожалуйста, введите вопрос.";
    responseDiv.classList.add("error");
    return;
  }
  
  // Проверка корректности URL, если он указан
  const url = docUrlElement.value.trim();
  if (url) {
    try {
      new URL(url); // Проверяем, что URL валидный
    } catch (e) {
      responseDiv.innerHTML = `<p class="error">Ошибка: URL '${url}' некорректен. Пожалуйста, введите правильный URL начинающийся с http:// или https://</p>`;
      responseDiv.classList.add("error");
      return;
    }
  }
  
  // Отключаем кнопку и показываем состояние загрузки
  askButton.classList.add('disabled');
  askButton.innerHTML = '<i class="bi bi-hourglass-split"></i> <span class="btn-text">Обработка...</span>';
  responseDiv.innerHTML = "Генерирую ответ...";
  responseDiv.className = "loading";
  
  // Показываем затемнение на мобильных
  const overlay = showMobileOverlay();

  try {
    const startTime = Date.now();
    
    // Создаем FormData для отправки данных
    const formData = new FormData();
    formData.append('question', question);
    
    // Добавляем параметры обработки
    formData.append('advanced_processing', advancedProcessing);
    if (advancedProcessing) {
      formData.append('chunk_size', chunkSize);
    }
    
    // Добавляем URL, если он указан
    if (url) {
      formData.append('url', url);
    }
    
    // Добавляем файл, если он выбран
    if (fileInput.files && fileInput.files[0]) {
      formData.append('file', fileInput.files[0]);
    }
    
    const res = await fetch("/ask", {
      method: "POST",
      body: formData
    });
    
    if (!res.ok) {
      // Улучшенная обработка HTTP ошибок от сервера
      if (res.status === 400) {
        throw new Error('Некорректный запрос. Пожалуйста, проверьте введенные данные.');
      } else if (res.status === 404) {
        throw new Error('Ресурс не найден. Возможно, указанный URL недоступен.');
      } else if (res.status === 413) {
        throw new Error('Размер загружаемого файла превышает лимит в 5 МБ.');
      } else if (res.status === 415) {
        throw new Error('Неподдерживаемый формат файла. Используйте только .docx, .pdf или .txt.');
      } else if (res.status >= 500) {
        throw new Error('Ошибка сервера. Пожалуйста, попробуйте позже.');
      } else {
        throw new Error(`HTTP ошибка: ${res.status}`);
      }
    }
    
    const data = await res.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    // Проверка результатов загрузки URL или файла
    if (data.source_error) {
      responseDiv.innerHTML = `
        <div class="warning">
          <p><i class="bi bi-exclamation-triangle"></i> <strong>Внимание:</strong> ${data.source_error}</p>
          <p>Используется документация по умолчанию.</p>
        </div>
        ${marked.parse(data.answer)}
      `;
      console.warn('Ошибка с источником данных:', data.source_error);
    } else {
      // Отображаем ответ с использованием marked
      try {
        responseDiv.innerHTML = marked.parse(data.answer);
        console.log('Ответ обработан через marked');
      } catch (e) {
        console.error('Ошибка при разборе markdown:', e);
        responseDiv.innerHTML = '<p>Ошибка форматирования ответа.</p><pre>' + data.answer + '</pre>';
      }
    }
    
    // Отдельный вызов подсветки после того, как HTML уже добавлен в DOM
    setTimeout(() => {
      applyHighlight();
      
      // Обработка специальных случаев с кодом без языка
      document.querySelectorAll('pre:not([data-lang]) code').forEach(function(block) {
        const parent = block.parentNode;
        if (parent && parent.tagName === 'PRE') {
          parent.setAttribute('data-lang', 'текст');
        }
      });
      
      // Добавляем копирование кода по клику на блок
      document.querySelectorAll('pre').forEach(function(preBlock) {
        // Если еще не добавлена кнопка копирования
        if (!preBlock.querySelector('.copy-btn')) {
          const copyBtn = document.createElement('button');
          copyBtn.className = 'copy-btn';
          copyBtn.innerHTML = '<i class="bi bi-clipboard"></i>';
          copyBtn.title = 'Копировать код';
          copyBtn.onclick = function(e) {
            e.stopPropagation();
            const code = preBlock.querySelector('code').innerText;
            navigator.clipboard.writeText(code).then(function() {
              copyBtn.innerHTML = '<i class="bi bi-clipboard-check"></i>';
              setTimeout(() => {
                copyBtn.innerHTML = '<i class="bi bi-clipboard"></i>';
              }, 2000);
            }).catch(function(err) {
              console.error('Ошибка при копировании: ', err);
            });
          };
          preBlock.appendChild(copyBtn);
        }
      });
    }, 50);
    
    responseDiv.className = "";
    
    // Если есть информация об использованных фрагментах, добавляем её
    if (data.chunks_info) {
      const chunksInfo = document.createElement('div');
      chunksInfo.className = 'chunks-info';
      chunksInfo.innerHTML = `<small><i class="bi bi-info-circle"></i> Найдено в ${data.chunks_info.used_chunks} релевантных фрагментах из ${data.chunks_info.total_chunks}</small>`;
      responseDiv.appendChild(chunksInfo);
    }
    
    // Добавляем обработку кликов по ссылкам внутри ответа
    const links = responseDiv.querySelectorAll('a');
    links.forEach(link => {
      if (link.hostname !== window.location.hostname) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    });
    
    // Показываем время выполнения запроса на мобильных
    const endTime = Date.now();
    const elapsedTime = (endTime - startTime) / 1000;
    
    // Добавляем информацию о времени ответа для малых экранов
    if (IS_MOBILE) {
      const timeInfo = document.createElement('div');
      timeInfo.className = 'time-info';
      timeInfo.innerHTML = `<small><i class="bi bi-clock"></i> ${elapsedTime.toFixed(1)} сек</small>`;
      responseDiv.appendChild(timeInfo);
    }
    
    // Прокручиваем к ответу на мобильных
    if (IS_MOBILE) {
      setTimeout(() => {
        responseDiv.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  } catch (err) {
    responseDiv.innerHTML = `<p class="error"><i class="bi bi-exclamation-triangle"></i> Ошибка: ${err.message}</p>`;
    responseDiv.className = "error";
  } finally {
    askButton.classList.remove('disabled');
    askButton.innerHTML = '<i class="bi bi-send"></i> <span class="btn-text">Спросить</span>';
    // Убираем затемнение
    removeMobileOverlay(overlay);
    // Обновляем размер текста кнопки
    adjustUIForScreenSize();
  }
}

// Настройка обработчиков событий
function setupEventHandlers() {
  document.getElementById('askButton').addEventListener('click', sendQuestion);
  document.getElementById('theme-toggle').addEventListener('click', function(e) {
    e.preventDefault();
    toggleTheme();
  });
  
  // Обработчик для кнопки сброса
  document.getElementById('reset-button').addEventListener('click', function(e) {
    e.preventDefault();
    resetForm();
  });
  
  document.querySelectorAll('.example-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const questionText = this.getAttribute('data-question');
      if (questionText) {
        setQuestion(questionText);
      }
    });
  });
  
  // Обработчик для переключателя расширенной обработки
  document.getElementById('advancedProcessing').addEventListener('change', toggleAdvancedProcessing);
  
  // Настройка адаптивного поведения для мобильных
  adjustUIForScreenSize();
  window.addEventListener('resize', adjustUIForScreenSize);
  
  // Дополнительная настройка для тач-устройств
  if (IS_MOBILE) {
    setupMobileUI();
    setupTouchTooltips();
  }
}

// Функция сброса формы и ответа
function resetForm() {
  // Очищаем поле вопроса
  document.getElementById('question').value = '';
  
  // Очищаем поле URL
  document.getElementById('docUrl').value = '';
  
  // Сбрасываем загруженный файл
  const fileInput = document.getElementById('docFile');
  fileInput.value = '';
  
  // Сбрасываем отображение имени файла
  const fileNameSpan = document.getElementById('fileName');
  const fileLabel = document.querySelector('.file-label');
  fileNameSpan.textContent = 'Файл';
  fileLabel.classList.remove('has-file');
  fileLabel.querySelector('i').className = 'bi bi-file-earmark-text';
  
  // Сбрасываем расширенную обработку
  const advancedProcessingToggle = document.getElementById('advancedProcessing');
  if (advancedProcessingToggle.checked) {
    advancedProcessingToggle.checked = false;
    toggleAdvancedProcessing();
  }
  
  // Очищаем ответ
  const answerDiv = document.getElementById('answer');
  answerDiv.innerHTML = '';
  answerDiv.classList.remove('loading');
  
  // Фокус на поле вопроса (для десктопа)
  if (!IS_MOBILE) {
    document.getElementById('question').focus();
  }
  
  // Добавляем эффект пульсации для кнопки сброса
  const resetButton = document.getElementById('reset-button');
  resetButton.classList.add('pulse-effect');
  setTimeout(() => {
    resetButton.classList.remove('pulse-effect');
  }, 500);
}

// Исправления для iOS Safari
function fixIOSInputs() {
  // Исправляем проблему с textarea на iOS
  const textarea = document.getElementById('question');
  if (textarea) {
    // Фикс для iOS - добавляем временное событие фокуса,
    // чтобы избежать проблем с виртуальной клавиатурой
    textarea.addEventListener('touchstart', function() {
      this.focus();
      setTimeout(() => {
        // Установим курсор в конец текста
        this.selectionStart = this.selectionEnd = this.value.length;
      }, 0);
    }, { passive: true });
    
    // Исправление для предотвращения масштабирования на iOS при фокусе
    textarea.addEventListener('focus', function() {
      // Добавляем meta viewport-fit=cover для предотвращения масштабирования на iOS
      let metaViewport = document.querySelector('meta[name="viewport"]');
      if (metaViewport) {
        metaViewport.setAttribute('content', 
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
      }
    });
  }
  
  // Исправление для ссылок на iOS
  document.querySelectorAll('a.btn, a.example-link, a.theme-icon').forEach(link => {
    // Добавляем невидимый элемент под ссылку,
    // чтобы увеличить область нажатия на iOS
    link.innerHTML = `<div style="position:absolute;top:0;left:0;right:0;bottom:0"></div>${link.innerHTML}`;
    
    // Предотвращаем двойное нажатие на iOS
    link.addEventListener('touchend', function(e) {
      e.preventDefault();
      
      // Запускаем клик программно, чтобы обойти проблемы iOS
      setTimeout(() => {
        this.click();
      }, 10);
    }, { passive: false });
  });
}

// Функция для обработки подсказок на тач-устройствах
function setupTouchTooltips() {
  // Найти все элементы с атрибутом title
  const elementsWithTooltips = document.querySelectorAll('[title]');
  
  elementsWithTooltips.forEach(element => {
    // Сохраняем текст подсказки в data-атрибуте
    const tooltipText = element.getAttribute('title');
    element.setAttribute('data-tooltip', tooltipText);
    
    // Для тач-устройств лучше использовать touchstart/touchend для подсказок
    element.addEventListener('touchstart', function(e) {
      // Предотвращаем стандартное поведение тача только для подсказок
      if (!this.classList.contains('example-link') && 
          !this.classList.contains('theme-icon') && 
          !this.id === 'askButton') {
        e.preventDefault();
      }
      
      // Добавляем класс для отображения подсказки
      this.classList.add('tooltip-active');
      
      // Скрываем подсказку через 3 секунды
      setTimeout(() => {
        this.classList.remove('tooltip-active');
      }, 3000);
    }, { passive: false });
    
    // Скрываем подсказку при касании другого элемента
    element.addEventListener('touchend', function() {
      setTimeout(() => {
        this.classList.remove('tooltip-active');
      }, 500);
    });
  });
  
  // Добавляем стили для активных подсказок на тач-устройствах
  addTouchTooltipStyles();
}

// Функция для добавления стилей подсказок на тач-устройствах
function addTouchTooltipStyles() {
  // Проверяем, есть ли уже элемент стиля
  let styleElement = document.getElementById('touch-tooltip-styles');
  
  if (!styleElement) {
    // Создаем новый элемент style
    styleElement = document.createElement('style');
    styleElement.id = 'touch-tooltip-styles';
    
    // Добавляем CSS для активной подсказки
    styleElement.textContent = `
      .tooltip-active::after {
        content: attr(data-tooltip);
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 0.5rem;
        border-radius: 4px;
        font-size: 0.8rem;
        white-space: normal;
        max-width: 200px;
        z-index: 100;
        margin-bottom: 5px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        text-align: center;
      }
      
      .tooltip-active::before {
        content: '';
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        border-width: 5px;
        border-style: solid;
        border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
        margin-bottom: -5px;
        z-index: 101;
      }
      
      @media (max-width: 576px) {
        .tooltip-active::after {
          white-space: normal;
          width: auto;
          max-width: 200px;
          left: 0;
          transform: none;
          font-size: 0.75rem;
        }
        
        .tooltip-active::before {
          left: 10px;
          transform: none;
        }
        
        .theme-icon.tooltip-active::after {
          right: 0;
          left: auto;
          transform: none;
        }
        
        .theme-icon.tooltip-active::before {
          right: 10px;
          left: auto;
          transform: none;
        }
      }
    `;
    
    // Добавляем стили в head
    document.head.appendChild(styleElement);
  }
}