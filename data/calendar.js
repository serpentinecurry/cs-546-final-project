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
        
        let courseLectures = lectureCollection.find({courseId: courseId}).toArray();
        for (let lecture of courseLectures) {
            lecture.courseCode = course.courseCode;
            lecture.time = course.meetingTime;
        }

        studentLectures = studentLectures.concat(courseLectures);
    }

    return studentLectures;
}

export default {lecturesToEventObjects};