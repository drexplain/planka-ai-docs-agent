// scripts/capture-and-document.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const url = process.argv[2] || 'https://plankanban.github.io/planka/';
const outputDir = path.join(__dirname, '..', 'output');
const screenshotsDir = path.join(outputDir, 'screenshots');

// Настройки: какие элементы считаем значимыми
const SIGNIFICANT_SELECTORS = [
  'button:visible',
  'a:visible[href]:not([href="#"]):not([href="/"])',
  'input:visible[type="text"], input:visible[type="email"], input:visible[type="password"], input:visible[type="search"]',
  'textarea:visible',
  'select:visible',
  'h1:visible, h2:visible',
  '.btn:visible, [role="button"]:visible',
];

(async () => {
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log(`Открываю ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle' });

  // --- Шаг 1: Скриншот главной страницы ---
  const mainScreenshotPath = path.join(screenshotsDir, '01-main.png');
  await page.screenshot({ path: mainScreenshotPath, fullPage: false });
  console.log('Скриншот сохранён');

  // --- Шаг 2: Сбор значимых элементов с координатами и текстами ---
  const elements = await page.evaluate((selectors) => {
    const results = [];
    const seen = new Set();

    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector);
      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        // Пропускаем элементы вне видимой области или слишком маленькие
        if (rect.width < 20 || rect.height < 15) continue;
        if (rect.top < 0 || rect.top > window.innerHeight) continue;
        if (rect.left < 0 || rect.left > window.innerWidth) continue;

        // Уникальность по координатам (избегаем дублирования вложенных элементов)
        const key = `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.width)},${Math.round(rect.height)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        // Извлекаем текст элемента
        let text = node.innerText?.trim().substring(0, 50) || '';
        // Если текст пустой, пробуем placeholder или aria-label
        if (!text) {
          text = node.getAttribute('placeholder') || node.getAttribute('aria-label') || node.getAttribute('title') || '';
        }
        // Для ссылок берём текст или title
        if (!text && node.tagName === 'A') {
          text = node.getAttribute('title') || node.href || '';
        }
        // Если совсем ничего, пишем тип элемента
        if (!text) {
          text = node.tagName.toLowerCase();
          if (node.type) text += `[type=${node.type}]`;
        }

        results.push({
          tag: node.tagName,
          text: text.trim(),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          href: node.href || null,
          selector: getUniqueSelector(node),
        });
      }
    }
    return results;

    // Простая функция получения уникального селектора (для отладки)
    function getUniqueSelector(el) {
      if (el.id) return `#${el.id}`;
      const path = [];
      while (el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.nodeName.toLowerCase();
        if (el.className) selector += '.' + Array.from(el.classList).join('.');
        path.unshift(selector);
        el = el.parentNode;
      }
      return path.join(' > ');
    }
  }, SIGNIFICANT_SELECTORS);

  console.log(`Найдено ${elements.length} значимых элементов`);

  // --- Шаг 3: Аннотирование скриншота ---
  // Готовим SVG с пронумерованными рамками
  let svgAnnotations = '';
  const descriptions = [];

  elements.slice(0, 15).forEach((el, idx) => {
    const num = idx + 1;
    // Рисуем прямоугольник
    svgAnnotations += `
      <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}"
            fill="none" stroke="#E53935" stroke-width="2" rx="3" />
      <!-- Номер в кружке -->
      <circle cx="${el.x - 5}" cy="${el.y - 5}" r="12" fill="#E53935" />
      <text x="${el.x - 5}" y="${el.y - 1}" fill="white" font-size="12" font-weight="bold"
            text-anchor="middle" alignment-baseline="middle">${num}</text>
    `;
    // Готовим текстовое описание для документации
    let desc = `**${num}. ${el.text || el.tag}**`;
    if (el.tag === 'INPUT') {
      desc += ' — поле ввода.';
    } else if (el.tag === 'BUTTON' || el.getAttribute?.('role') === 'button') {
      desc += ' — кнопка.';
    } else if (el.tag === 'A') {
      desc += ` — ссылка${el.href ? ' на ' + el.href : ''}.`;
    } else if (el.tag.match(/^H[1-6]$/)) {
      desc += ' — заголовок раздела.';
    } else {
      desc += ' — элемент интерфейса.';
    }
    descriptions.push(desc);
  });

  // Накладываем SVG на скриншот
  const annotatedPath = path.join(screenshotsDir, '01-main-annotated.png');
  if (svgAnnotations) {
    const svg = `<svg width="1280" height="800">${svgAnnotations}</svg>`;
    await sharp(mainScreenshotPath)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .toFile(annotatedPath);
    console.log('Аннотированный скриншот создан');
  } else {
    // Если элементов нет, просто копируем исходный скриншот
    fs.copyFileSync(mainScreenshotPath, annotatedPath);
  }

  // --- Шаг 4: Сборка Markdown-документации ---
  const title = await page.title();
  const docContent = `# Руководство пользователя — ${title}

**Источник:** [${url}](${url})

## Главная страница

![Нумерованный скриншот главной страницы](screenshots/01-main-annotated.png)

### Описание ключевых элементов

${descriptions.map(d => `- ${d}`).join('\n')}

> Документация сгенерирована автоматически. При необходимости отредактируйте вручную.
`;

  fs.writeFileSync(path.join(outputDir, 'README.md'), docContent);
  console.log('README.md сохранён');

  await browser.close();
})();
