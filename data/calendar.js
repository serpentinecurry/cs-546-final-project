import { ObjectId } from 'mongodb';
import { users, courses, lectures } from '../config/mongoCollections.js';
// import { courseData } from './index.js';


// function that returns an array of all lectures for a given student
const getStudentLectures = async (studentId) => {
    const userCollection = await users();
    const student = await userCollection.findOne({_id: new ObjectId(studentId)});

    if (!student)
        throw `Student with ID ${studentId} not found`;

    const courseCollection = await courses();
    // get courses that the student is in
    const studentCourses = await courseCollection
        .find({
            "studentEnrollments.studentId": new ObjectId(studentId),
            "studentEnrollments.status": "active"
        })
        .toArray();

    // array of all the students' lectures
    let studentLectures = [];
    const lectureCollection = await lectures();

    for (let course of studentCourses) {
        let courseId = course._id;
        
        let courseLectures = await lectureCollection.find({courseId: courseId}).toArray();
        for (let lecture of courseLectures) {
            lecture.courseCode = course.courseCode;
        }

        studentLectures = studentLectures.concat(courseLectures);
    }

    return lecturesToEventObjects(studentLectures);
}

const parseTimeString = (timeString) => {
    let hours, minutes, timeOfDay;
    [hours, minutes] = timeString.split(':');
    [minutes, timeOfDay] = minutes.split(' ');

    if (timeOfDay == 'PM') {
        hours += 12
    } else if (hours == 12) {
        hours -= 12;
    }

    return {hours: hours, minutes: minutes};
}

const lecturesToEventObjects = async (lectures) => {
    let events = [];

    for (let l of lectures) {
        const eventObject = {};
        // event id: "coursecode-date" (e.g. CS-546-2025-04-15)
        eventObject.id = l.courseCode + "-" + l.lectureDate;
        // CS-546 - Learn AJAX
        eventObject.title = l.courseCode + " - " + l.lectureTitle;

        // initialize date objects
        let start = new Date(l.lectureDate);
        let end = new Date(l.lectureDate);

        // get start and end time
        let startTime = l.lectureStartTime.split(':');
        let endTime = l.lectureEndTime.split(':');

        start.setHours(startTime[0]);
        start.setMinutes(startTime[1]);
        end.setHours(endTime[0]);
        end.setMinutes(endTime[1]);

        eventObject.start = start;
        eventObject.end = end;

        events.push(JSON.stringify(eventObject));
    }

    return events;
}

export default {getStudentLectures};