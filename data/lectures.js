import { lectures } from "../config/mongoCollections.js";
import { ObjectId } from "mongodb";
import { stringValidate } from "../validation.js";

// {
//     "_id": "ObjectId",
//     "courseId": "ObjectId_course",
//     "professorId": "ObjectId_professor",
//     "lectureTitle": "Week 5: AJAX and Fetch API",
//     "lectureDate": "2025-04-01",
//     "description": "Covered asynchronous JavaScript.",
//     "materialsLink": "https://drive.google.com/some-slides",
//     "ratings": [{
//         "studentId": "ObjectId_student1",
//         "rating": 5
//       }],
//     "createdAt": "timestamp",
//     "updatedAt": "timestamp"
//   }
  

//functions include creating, updating, inserting a rating, 


let createLecture = async (courseId, professorId, lectureTitle, lectureDate, description, materialsLink) => {


    courseId = stringValidate(courseId);
    professorId = stringValidate(professorId);
    lectureTitle = stringValidate(lectureTitle);
    lectureDate = stringValidate(lectureDate);
    description = stringValidate(description);
    materialsLink = stringValidate(materialsLink);
    if (!ObjectId.isValid(courseId)) {
        throw "Invalid course ID.";
    }
    if (!ObjectId.isValid(professorId)) {
        throw "Invalid professor ID.";
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lectureDate)) {
        throw "Lecture date must be in YYYY-MM-DD format.";
    }

    const PrevLecture = await lectures()
    const existingLecture = await PrevLecture.findOne({
        courseId: new ObjectId(courseId),
        lectureTitle: { $regex: `^${lectureTitle}$`, $options: "i" }
    });


    if (existingLecture) {
        throw "Lecture title already exists for this course. Please choose a different title.";
    }




    const lectureCollection = await lectures();
    const newLecture = {
        courseId: courseId, 
        professorId: professorId, 
        lectureTitle: lectureTitle,
        lectureDate: lectureDate,
        description: description,
        materialsLink: materialsLink,
        ratings: [],
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const insertion = await lectureCollection.insertOne(newLecture);
    if (!insertion.acknowledged) {
        throw "Could not make lecture";
    }

    return { isLectureCreated: true, lectureId: insertion.insertedId.toString() };

}



let updateLecture = async (lectureId, updates) => {

    lectureId = stringValidate(lectureId)
    let lectureList = await lectures();
    try {
        lectureList = await lectureList.findOne({ _id: new ObjectId(lectureId) });
        if (!lectureList) {
            throw "Lecture not found";
        }
        if (updates.lectureTitle) {
            updates.lectureTitle = stringValidate(updates.lectureTitle);
        }
        if (updates.lectureDate) {
            updates.lectureDate = stringValidate(updates.lectureDate);
        }
        if (updates.description) {
            updates.description = stringValidate(updates.description);
        }
        if (updates.materialsLink) {
            updates.materialsLink = stringValidate(updates.materialsLink);
        }

        updates.updatedAt = new Date();

        const lectureCollection = await lectures();

        const updateInfo = await lectureCollection.updateOne(
            { _id: new ObjectId(lectureId) },
            { $set: updates }
        );

        return updateInfo
    } catch (error) {
        throw error;
    }

}


let insertRating = async (lectureId, studentId, rating) => {


    lectureId = stringValidate(lectureId);
    studentId = stringValidate(studentId);
    rating = parseInt(rating);
    if (isNaN(rating) || rating < 1 || rating > 5) {
        throw "Rating must be a number between 1 and 5.";
    }
    if (!ObjectId.isValid(lectureId)) {
        throw "Invalid lecture ID.";
    }
    if (!ObjectId.isValid(studentId)) {
        throw "Invalid student ID.";
    }
    const lectureCollection = await lectures();
    const lecture = await lectureCollection.updateInfo({
        _id: new ObjectId(lectureId),
        ratings: { $not: { $elemMatch: { studentId: new ObjectId(studentId) } } }
    }, {
        $push: {
            ratings: {
                studentId: new ObjectId(studentId),
                rating: rating
            }
        },
        
    })

}




export default {
    createLecture,
    updateLecture,
    insertRating
}