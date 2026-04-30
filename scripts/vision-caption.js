const { pipeline } = require('@xenova/transformers');

let captioner = null;

async function getCaption(imagePath) {
  if (!captioner) {
    console.log('Загружаю модель анализа изображений (первый запуск может занять время)...');
    captioner = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning');
  }
  const result = await captioner(imagePath);  // передаём путь к файлу
  return result[0].generated_text;
}

module.exports = { getCaption };
