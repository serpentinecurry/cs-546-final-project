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
    let courses = await courseCollection
        .find({
            "studentEnrollmentRequests.studentId": new ObjectId(studentId),
            "studentEnrollmentRequests.status": "active"
        })
        .toArray();

    // array of all the students' lectures
    let studentLectures = [];
    const lectureCollection = await studentLectures();

    for (let course of courses) {
        let courseId = course._id;
        
        let courseLectures = await lectureCollection.find({courseId: courseId}).toArray();
        for (let lecture of courseLectures) {
            lecture.courseCode = course.courseCode;
            lecture.time = course.meetingTime;
        }

        studentLectures = studentLectures.concat(courseLectures);
    }

    return studentLectures;
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
        let startTimeString, endTimeString;
        [startTimeString, endTimeString] = l.time.split(' - ');

        const startTime = parseTimeString(startTimeString);
        const endTime = parseTimeString(endTimeString);

        start.setHours(startTime.hours);
        start.setMinutes(startTime.minutes);
        end.setHours(endTime.hours);
        end.setMinutes(endTime.minutes);

        eventObject.start = start;
        eventObject.end = end;

        events.push(eventObject);
    }

    return events;
}

export default {lecturesToEventObjects};