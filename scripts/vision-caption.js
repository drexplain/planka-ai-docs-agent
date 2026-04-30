// scripts/vision-caption.js
const { pipeline } = require('@xenova/transformers');

let captioner = null;

async function getCaption(imageBuffer) {
  if (!captioner) {
    console.log('Загружаю модель анализа изображений (первый запуск может занять время)...');
    captioner = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning');
  }
  const result = await captioner(imageBuffer);
  return result[0].generated_text;
}

module.exports = { getCaption };
