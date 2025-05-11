(function () {
  const stringValidate = (str) => {
    if (str === undefined || str === null)
      throw `Enter a string argument — received: ${str}`;
    if (typeof str !== "string")
      throw `Argument must be a string, not ${typeof str} (${JSON.stringify(
        str
      )})`;
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

  let firstName = document.getElementById("firstName");
  let lastName = document.getElementById("lastName");
  let email = document.getElementById("email");
  let dateOfBirth = document.getElementById("dateOfBirth");
  let gender = document.getElementById("gender");
  let password = document.getElementById("password");
  let confirmPassword = document.getElementById("confirmPassword");
  let createProfessorForm = document.getElementById("admin-create-formm");
  let errorContainer = document.getElementById("error");
  if (createProfessorForm) {
    createProfessorForm.addEventListener("submit", (e) => {
      e.preventDefault();
      errorContainer.hidden = true;
      errorContainer.textContent = "";
      try {
        const firstNameVal = stringValidate(firstName.value.trim());
        azAZLenValidate(firstNameVal, 2, 20);
        const lastNameVal = stringValidate(lastName.value.trim());
        azAZLenValidate(lastNameVal, 2, 20);
        if (!["male", "female", "other"].includes(gender.value))
          throw "Invalid Gender";
        const theEmail = validateEmail(email.value.trim());
        passwordValidate(password.value);
        if (!confirmPassword.value || typeof confirmPassword.value !== "string")
          throw "Enter confirm Password of type string";
        if (password.value !== confirmPassword.value)
          throw "Passwords dont match!";
        if (!isValidDateString(dateOfBirth.value)) {
          throw "Invalid date of birth";
        }
        createProfessorForm.submit();
      } catch (error) {
        errorContainer.hidden = false;
        errorContainer.textContent =
          typeof error === "string" ? error : error.message;
      }
    });
  }
})();
