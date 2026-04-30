// scripts/capture-and-document.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const url = process.argv[2] || 'https://plankanban.github.io/planka/';
const outputDir = path.join(__dirname, '..', 'output');
const screenshotsDir = path.join(outputDir, 'screenshots');

(async () => {
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log(`Открываю ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle' });

  // --- Шаг 1: Скриншот главной страницы ---
  const mainScreenshotPath = path.join(screenshotsDir, '01-main.png');
  await page.screenshot({ path: mainScreenshotPath, fullPage: true });
  console.log('Скриншот главной сохранён');

  // --- Шаг 2: Сбор текстовых данных для описания ---
  const pageData = await page.evaluate(() => {
    // Берём текст из <h1> или первого крупного заголовка
    const h1 = document.querySelector('h1')?.innerText?.trim();
    const title = document.title || h1 || 'Главная страница';

    // Извлекаем названия ключевых кнопок/ссылок
    const buttons = Array.from(document.querySelectorAll('button, a.btn, .nav-link, [role="button"]'))
      .slice(0, 5)
      .map(el => el.innerText.trim())
      .filter(Boolean);

    return { title, buttons };
  });

  // --- Шаг 3: Поиск элемента логотипа для аннотации ---
  const logoElement = await page.$('header img, .logo img, a.navbar-brand img');
  let annotationBoxes = [];
  if (logoElement) {
    const box = await logoElement.boundingBox();
    annotationBoxes.push({
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
      label: 'Логотип / ссылка на главную'
    });
  }

  // Аннотированный скриншот (если есть что обводить)
  let finalImagePath = mainScreenshotPath;
  if (annotationBoxes.length > 0) {
    const svgOverlay = annotationBoxes.map(b =>
      `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}"
             fill="none" stroke="red" stroke-width="2" rx="3"/>
       <text x="${b.x}" y="${b.y - 5}" fill="red" font-size="14">${b.label}</text>`
    ).join('');
    const svg = `<svg width="1280" height="800">${svgOverlay}</svg>`;
    finalImagePath = path.join(screenshotsDir, '01-main-annotated.png');
    await sharp(mainScreenshotPath)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .toFile(finalImagePath);
    console.log('Аннотированный скриншот готов');
  }

  // --- Шаг 4: Формирование осмысленного описания из извлечённых текстов ---
  let caption = pageData.title;
  if (pageData.buttons.length > 0) {
    caption += '\n\nОсновные элементы: ' + pageData.buttons.join(', ');
  } else {
    caption += '\n\nСтраница загружена автоматически.';
  }

  // --- Шаг 5: Сборка Markdown ---
  const docContent = `# Руководство пользователя (автоматическая генерация)

**Источник:** ${url}

## Главная страница

![Главная страница](screenshots/01-main-annotated.png)

${caption}

> Документация сгенерирована автоматически. При необходимости отредактируйте вручную.
`;

  fs.writeFileSync(path.join(outputDir, 'README.md'), docContent);
  console.log('Документация сохранена в output/README.md');

  await browser.close();
})();
