import { pipeline } from '@xenova/transformers';

let captioner = null;

async function getCaption(imageBuffer) {
  if (!captioner) {
    // Загружаем модель один раз
    captioner = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning');
  }
  // Конвертируем скриншот в формат, который понимает модель
  const result = await captioner(imageBuffer);
  return result[0].generated_text;
}
