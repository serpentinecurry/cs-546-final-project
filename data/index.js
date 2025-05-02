import userDataFunctions from "./users.js";
import coursesDataFunctions from "./courses.js";
import lecturesDataFunctions from "./lectures.js";
import attendanceDataFunctions from "./attendance.js";
import professorRoutes from "../routes/professor.js";

export const userData = userDataFunctions;
export const courseData = coursesDataFunctions;
export const lectureData = lecturesDataFunctions;
export const attendanceData = attendanceDataFunctions;
export const professorData = professorRoutes;