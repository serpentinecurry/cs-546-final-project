// utils/templateHelpers.js
import fs from "fs";
import path from "path";
import handlebars from "handlebars"; // ✅ Correct package

export const loadPartial = (name) => {
  try {
    const filePath = path.join(process.cwd(), 'views', 'student', 'partials', `${name}.handlebars`);
    const content = fs.readFileSync(filePath, 'utf-8');
    return handlebars.compile(content)(); // ✅ Compile and return HTML
  } catch (error) {
    console.error(`❌ Failed to load partial: ${name}`, error);
    return '';
  }
};
