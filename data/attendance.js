import { attendance } from "../config/mongoCollections.js";
import { ObjectId } from "mongodb";
import { stringValidate } from "../validation.js";

// {
//     "_id": "ObjectId",
//     "lectureId": "ObjectId_lecture",
//     "courseId": "ObjectId_course",
//     "studentId": "ObjectId_student",
//     "status": "present",
//     "points": 0,
//     "createdAt": "timestamp"  
// }

let createAttendance = async (lectureId, courseId, studentId, status, points) => {

    const attendanceCollection = await attendance();

    attendanceCollection.insertOne({
        lectureId: lectureId,
        courseId: courseId, 
        studentId: studentId,
        status: status,
        points: points,
        createdAt: new Date()
    })

}

let updateAttendance = async (attendanceId, updates) => {

    attendancCollection = await attendance();
    attendanceId = stringValidate(attendanceId);
    let attendanceRecord = await attendancCollection.findOne({ _id: new ObjectId(attendanceId) });
    if (!attendanceRecord) {
        throw "Attendance not found";
    }


}

export default {
    createAttendance

}
