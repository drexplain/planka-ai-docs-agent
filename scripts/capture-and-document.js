// scripts/capture-and-document.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const url = process.argv[2] || 'https://demo.planka.cloud';
const outputDir = path.join(__dirname, '..', 'output');
const screenshotsDir = path.join(outputDir, 'screenshots');

// Значимые элементы (CSS-селекторы БЕЗ псевдоклассов типа :visible)
const SIGNIFICANT_SELECTORS = [
  'button',
  'a[href]:not([href="#"]):not([href="/"])',
  'input[type="text"], input[type="email"], input[type="password"], input[type="search"]',
  'textarea',
  'select',
  'h1, h2',
  '.btn, [role="button"]',
];

(async () => {
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log(`Открываю ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle' });

  // --- Скриншот ---
  const mainScreenshotPath = path.join(screenshotsDir, '01-main.png');
  await page.screenshot({ path: mainScreenshotPath, fullPage: false });
  console.log('Скриншот сохранён');

  // --- Сбор видимых элементов ---
  const elements = await page.evaluate((selectors) => {
    const results = [];
    const seen = new Set();

    // Функция проверки видимости элемента
    const isVisible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return false;
      if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) return false;
      // Проверка, не перекрыт ли элемент полностью (грубо: если размер есть, считаем видимым)
      return true;
    };

    for (const selector of selectors) {
      try {
        const nodes = document.querySelectorAll(selector);
        for (const node of nodes) {
          if (!isVisible(node)) continue;

          const rect = node.getBoundingClientRect();
          // Уникальность по координатам и размерам (избегаем дублирования)
          const key = `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.width)},${Math.round(rect.height)}`;
          if (seen.has(key)) continue;
          seen.add(key);

          // Извлекаем текст или плейсхолдер
          let text = node.innerText?.trim().substring(0, 50) || '';
          if (!text) {
            text = node.getAttribute('placeholder') || node.getAttribute('aria-label') || node.getAttribute('title') || '';
          }
          if (!text && node.tagName === 'A') {
            text = node.getAttribute('title') || (node.href ? new URL(node.href).pathname : '');
          }
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
          });
        }
      } catch (e) {
        // Игнорируем ошибки невалидных селекторов
      }
    }
    return results;
  }, SIGNIFICANT_SELECTORS);

  console.log(`Найдено ${elements.length} значимых элементов`);

  // --- Аннотирование ---
  let svgAnnotations = '';
  const descriptions = [];

  elements.slice(0, 15).forEach((el, idx) => {
    const num = idx + 1;
    // Прямоугольник
    svgAnnotations += `
      <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}"
            fill="none" stroke="#E53935" stroke-width="2" rx="3" />
      <!-- Кружок с номером -->
      <circle cx="${el.x - 5}" cy="${el.y - 5}" r="12" fill="#E53935" />
      <text x="${el.x - 5}" y="${el.y - 1}" fill="white" font-size="12" font-weight="bold"
            text-anchor="middle" alignment-baseline="middle">${num}</text>
    `;

    // Описание элемента
    let desc = `**${num}. ${el.text || el.tag}**`;
    if (el.tag === 'INPUT' || el.tag === 'TEXTAREA') {
      desc += ' — поле ввода.';
    } else if (el.tag === 'BUTTON' || el.tag === 'A' || el.tag === 'SELECT') {
      desc += ' — элемент управления.';
    } else if (el.tag.match(/^H[1-6]$/)) {
      desc += ' — заголовок.';
    } else {
      desc += ' — элемент интерфейса.';
    }
    descriptions.push(desc);
  });

  // Наложение аннотаций
  const annotatedPath = path.join(screenshotsDir, '01-main-annotated.png');
  if (svgAnnotations) {
    const svg = `<svg width="1280" height="800">${svgAnnotations}</svg>`;
    await sharp(mainScreenshotPath)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .toFile(annotatedPath);
    console.log('Аннотированный скриншот создан');
  } else {
    fs.copyFileSync(mainScreenshotPath, annotatedPath);
  }

  // --- Генерация Markdown ---
  const pageTitle = await page.title();
  const docContent = `# Руководство пользователя — ${pageTitle}

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
