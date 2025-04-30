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

// uses createAttendance, updateAttendance, it will be adding 1 point for each class missed, for now excused does not add points
let createAttendance = async (lectureId, courseId, studentId, status) => {

    const attendanceCollection = await attendance();
    lectureId = stringValidate(lectureId);
    courseId = stringValidate(courseId);
    studentId = stringValidate(studentId);
    status = stringValidate(status);
    if (!ObjectId.isValid(lectureId)) {
        throw "Invalid lecture ID.";
    }
    if (!ObjectId.isValid(courseId)) {
        throw "Invalid course ID.";
    }
    if (!ObjectId.isValid(studentId)) {
        throw "Invalid student ID.";
    }
    if (status === "present" || status === "absent" || status === "excused") {
        throw "Status must be either 'present' or 'absent or excused '.";
    }
    if (status === "present") {
        points = 0; 
    }
    else if (status === "excused") {
        points = 0
    }
    else {
        point = 1
    }



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
    let existingAttendance = await attendancCollection.findOne({ _id: new ObjectId(attendanceId) });
    if (!existingAttendance) {
        throw "Attendance record not found";
    }

    if (updates.status) {
        updates.status = stringValidate(updates.status);
        if (updates.status !== "present" && updates.status !== "absent" && updates.status !== "excused") {
            throw "Status must be either 'present', 'absent', or 'excused'.";
        }
    }
    if (updates.points) {
        updates.points = parseInt(updates.points);
        if (isNaN(updates.points) || updates.points < 0) {
            throw "Points must be a non-negative number.";
        }
    }
    updates.updatedAt = new Date();
    const updateInfo = await attendancCollection.updateOne(
        { _id: new ObjectId(attendanceId) },
        { $set: updates }
    );
    if (updateInfo.modifiedCount === 0) {
        throw "Could not update attendance record";
    }
    return { isUpdated: true, attendanceId: attendanceId };


}

export default {
    createAttendance,
    updateAttendance
}
