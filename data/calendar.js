import { ObjectId } from 'mongodb';
import { users } from '../config/mongoCollections.js';
import { courseData } from './index.js';

const getOfficeHours = async (studentId) => {
    const userCollection = await users();
    const student = await userCollection.findOne({_id: new ObjectId(studentId)});
    const courseIds = student.enrolledCourses;

    let returnResult = [];

    for (let courseId of courseIds) {
        const courseInfo = await courseData.getCourseById(courseId);
        // object w/ course code and array of office hours
        const officeHoursInfo = {courseCode: courseInfo.course.courseCode};
        let officeHours = courseInfo.course.taOfficeHours;

        for (let item of officeHours) {
            const taId = item.taId;
            const taInfo = userCollection.findOne({_id: new ObjectId(taId)});
            let taName = taInfo.firstName + " " + taInfo.lastName;

            item.name = taName;
        }

        const professorOfficeHours = courseInfo.course.professorOfficeHours;
        const professorInfo = courseInfo.professor;
        professorOfficeHours.name = professorInfo.firstName + " " + professorInfo.lastName;
        officeHours.push(professorOfficeHours);

        officeHoursInfo.officeHours = officeHours;

        returnResult.push(officeHoursInfo);
    }

    return returnResult;
}

export default {getOfficeHours};