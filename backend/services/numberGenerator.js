const dayjs = require('dayjs');

const generateNumberWithCounter = (prefix, counter) => {
  const dateStr = dayjs().format('YYYYMMDD');
  const counterStr = String(counter).padStart(4, '0');
  return `${prefix}-${dateStr}-${counterStr}`;
};

const extractDateFromNumber = (number) => {
  const parts = number.split('-');
  if (parts.length < 2) return null;

  try {
    const dateStr = parts[1];
    return dayjs(dateStr, 'YYYYMMDD').toDate();
  } catch {
    return null;
  }
};

const incrementCounter = (lastNumber, prefix) => {
  if (!lastNumber) return 1;

  const parts = lastNumber.split('-');
  if (parts.length < 3) return 1;

  try {
    const counter = parseInt(parts[2], 10);
    return counter + 1;
  } catch {
    return 1;
  }
};

module.exports = {
  generateNumberWithCounter,
  extractDateFromNumber,
  incrementCounter
};
