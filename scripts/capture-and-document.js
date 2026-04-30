// scripts/capture-and-document.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { getCaption } = require('./vision-caption');

const url = process.argv[2] || 'https://demo.planka.cloud';
const outputDir = path.join(__dirname, '..', 'output');
const screenshotsDir = path.join(outputDir, 'screenshots');

(async () => {
  // Создаём папки для результатов
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

  // --- Шаг 2: Аннотация (пример – обвести логотип) ---
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

  if (annotationBoxes.length > 0) {
    const svgOverlay = `<svg width="1280" height="800">
      ${annotationBoxes.map(b => `
        <rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}"
              fill="none" stroke="red" stroke-width="2" rx="3"/>
        <text x="${b.x}" y="${b.y - 5}" fill="red" font-size="14">${b.label}</text>
      `).join('')}
    </svg>`;
    const annotatedPath = path.join(screenshotsDir, '01-main-annotated.png');
    await sharp(mainScreenshotPath)
      .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
      .toFile(annotatedPath);
    console.log('Аннотированный скриншот готов');
  }

  // --- Шаг 3: Подпись от локальной модели ---
  const caption = await getCaption(mainScreenshotPath);
  console.log('Описание от модели:', caption);

  // --- Шаг 4: Сборка Markdown ---
  const docContent = `# Руководство пользователя (автоматическая генерация)

  **Источник:** ${url}

  ## Главная страница

  ![Главная страница](screenshots/01-main-annotated.png)

  ${caption || '*Описание отсутствует*'}

  > Документация сгенерирована автоматически. При необходимости отредактируйте вручную.
  `;

  fs.writeFileSync(path.join(outputDir, 'README.md'), docContent);
  console.log('Документация сохранена в output/README.md');

  await browser.close();
})();
