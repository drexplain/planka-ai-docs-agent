// scripts/vision-caption.js
module.exports = { getCaption };

async function getCaption(imagePath) {
  // Больше не загружаем нейросеть – просто возвращаем заглушку.
  // Основную логику описания мы перенесём прямо в capture-and-document,
  // где у нас есть доступ к странице (page).
  // Здесь ничего не делаем.
  return '';
}
