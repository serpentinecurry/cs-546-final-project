const stringValidate = (str) => {
  if (str === undefined || str === null)
    throw `Enter a string argument — received: ${str}`;
  if (typeof str !== "string")
    throw `Argument must be a string, not ${typeof str} (${JSON.stringify(str)})`;
  if (str.trim().length === 0)
    throw `Argument cannot be an empty string or just spaces — received: "${str}"`;
  return str.trim();
};


const azAZLenValidate = (str, min, max) => {
  if (str.length < min) throw `${str} length must be greater than ${min}!`;
  if (str.length > max) throw `${str} length must be lesser than ${max}!`;
  for (let char of str) {
    if (!(char >= "A" && char <= "Z") && !(char >= "a" && char <= "z")) {
      throw `${char} is Invalid character in ${str}`;
    }
  }
};

const validateEmail = (email) => {
  email = stringValidate(email);
  // got email regex from https://regex101.com/library/SOgUIV
  const emailRegex = /^((?!\.)[\w\-_.]*[^.])(@\w+)(\.\w+(\.\w+)?[^.\W])$/;
  if (!emailRegex.test(email)) {
    throw `Email (${email}) is not valid!`;
  }
  return email.toLowerCase();
};

const hasSpecialChar = (char) => {
  const ascii = char.charCodeAt(0);
  const isLetter =
    (ascii >= 65 && ascii <= 90) || (ascii >= 97 && ascii <= 122);
  const isDigit = ascii >= 48 && ascii <= 57;
  const isSpace = ascii === 32;
  if (!isLetter && !isDigit && !isSpace) return true;
  return false;
};

const passwordValidate = (password) => {
  if (!password) throw `Enter Password of type String, not ${password}`;
  if (typeof password !== "string")
    throw `Password must be a string, not ${password}`;
  if (password.trim().length === 0)
    throw `Password cannot be an empty string or string with just spaces, hence "${password}" is invalid`;
  if (password.length < 8)
    throw "Password length must be at least 8 Characters";
  let upperCaseCount = 0;
  let numberCount = 0;
  let specialCharCount = 0;
  for (let char of password) {
    if (char >= "A" && char <= "Z") upperCaseCount += 1;
    else if (char >= "0" && char <= "9") numberCount += 1;
    else if (hasSpecialChar(char)) specialCharCount += 1;
    if (char === " ") throw "Spaces are not allowed in Password";
  }
  if (upperCaseCount === 0)
    throw "Password must contain at least one uppercase letter";
  if (numberCount === 0) throw "Password must contain at least one number";
  if (specialCharCount === 0)
    throw "Password must contain at least one special character";
};

function isValidDateString(dateStr) {
  const date = new Date(dateStr);
  return !isNaN(date.getTime()); // true if valid date
}

const calculateAge = (dateOfBirth) => {
  const dob = new Date(dateOfBirth); // e.g., "1998-05-15"
  const today = new Date();

  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();

  // If birth month hasn't occurred yet this year, or it's this month but birthday hasn't passed
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
  }

  return age;
}

const parse12HourTime = (timeStr) => {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) return null;

  let [_, hour, minute, meridiem] = match;
  hour = parseInt(hour, 10);
  minute = parseInt(minute, 10);

  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

  if (meridiem.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (meridiem.toUpperCase() === "AM" && hour === 12) hour = 0;

  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
};

const isValid24Hour = (timeStr) => {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr);
};

const isStartBeforeEnd = (start, end) => {
  let [sh, sm] = start.split(":").map(Number);
  let [eh, em] = end.split(":").map(Number);
  return sh < eh || (sh === eh && sm < em);
};

export {
  stringValidate,
  azAZLenValidate,
  validateEmail,
  passwordValidate,
  isValidDateString,
  calculateAge,
  parse12HourTime,
  isValid24Hour,
  isStartBeforeEnd
};
