import {lectures, courses} from "../config/mongoCollections.js";
import {ObjectId} from "mongodb";
import {stringValidate} from "../validation.js";

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


let createLecture = async (courseId, lectureTitle, lectureDate, lectureStartTime, lectureEndTime, description, materialsLink) => {
    if (!courseId || !lectureTitle || !lectureDate || !lectureStartTime || !lectureEndTime || !description || !materialsLink) {
        throw "All fields are required.";
    }

    courseId = stringValidate(courseId);
    lectureTitle = stringValidate(lectureTitle);
    lectureDate = stringValidate(lectureDate);
    lectureStartTime = stringValidate(lectureStartTime);
    lectureEndTime = stringValidate(lectureEndTime);
    description = stringValidate(description);
    materialsLink = stringValidate(materialsLink);

    if (!ObjectId.isValid(courseId)) {
        throw "Invalid course ID.";
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(lectureDate)) {
        throw "Lecture date must be in YYYY-MM-DD format.";
    }

    if (lectureDate < new Date().toISOString().split('T')[0]) {
        throw "Lecture date must be today or in the future.";
    }

    if (!/^\d{2}:\d{2}$/.test(lectureStartTime)) {
        throw "Lecture Start time must be in HH:MM format.";
    }

    const startDateTime = new Date(`${lectureDate}T${lectureStartTime}:00`);
    let endDateTime = new Date(`${lectureDate}T${lectureEndTime}:00`);

// If end time is earlier than or equal to start, assume it goes to next day
    if (endDateTime <= startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
    }

    if (startDateTime >= endDateTime) {
        throw new Error("Lecture Start time must be before Lecture End time.");
    }

    if (!/^\d{2}:\d{2}$/.test(lectureEndTime)) {
        throw "Lecture End time must be in HH:MM format.";
    }

    const courseCollection = await courses();
    const courseDoc = await courseCollection.findOne({_id: new ObjectId(courseId)});

    if (!courseDoc) {
        throw "Course ID does not exist.";
    }

    const professorId = courseDoc.professorId?.toString();
    if (!ObjectId.isValid(professorId)) {
        throw "Invalid professor ID in course.";
    }

    const lectureCollection = await lectures();

    // Check for duplicate lecture title in the same course
    const existingTitle = await lectureCollection.findOne({
        courseId: new ObjectId(courseId),
        lectureTitle: {$regex: `^${lectureTitle}$`, $options: "i"}
    });

    if (existingTitle) {
        throw "Lecture title already exists for this course. Please choose a different title.";
    }

    // ✅ Check for conflict on date and time
    const existingConflict = await lectureCollection.findOne({
        courseId: new ObjectId(courseId),
        lectureDate,
        lectureStartTime,
        lectureEndTime: {$gte: lectureStartTime}
    });

    if (existingConflict) {
        throw `A lecture already exists for ${lectureDate} at ${lectureStartTime} till ${lectureEndTime}. Please pick a different time.`;
    }

    const newLecture = {
        courseId: new ObjectId(courseId),
        professorId: new ObjectId(professorId),
        lectureTitle,
        lectureDate,
        lectureStartTime,
        lectureEndTime,
        description,
        materialsLink,
        ratings: [],
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const insertion = await lectureCollection.insertOne(newLecture);
    if (!insertion.acknowledged) {
        throw "Could not create lecture.";
    }

    return {
        isLectureCreated: true,
        lectureId: insertion.insertedId.toString()
    };
};


const updateLecture = async (lectureId, updates) => {


    lectureId = stringValidate(lectureId)
    let lectureList = await lectures();
    try {
        lectureList = await lectureList.findOne({_id: new ObjectId(lectureId)});
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
            {_id: new ObjectId(lectureId)},
            {$set: updates}
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
    const lecture = await lectureCollection.updateOne({
        _id: new ObjectId(lectureId),
        ratings: {$not: {$elemMatch: {studentId: new ObjectId(studentId)}}}
    }, {
        $push: {
            ratings: {
                studentId: new ObjectId(studentId),
                rating: rating
            }
        }
    });

    return {isRatingAdded: true};
}


const getLectureById = async (lectureId) => {
    if (!lectureId) throw 'Lecture ID is required';
    if (typeof lectureId !== 'string') throw 'Lecture ID must be a string';
    lectureId = lectureId.trim();
    if (lectureId.length === 0) throw 'Lecture ID cannot be empty';

    try {
        const lecturesCollection = await lectures();
        const objectId = new ObjectId(lectureId);
        const lecture = await lecturesCollection.findOne({_id: objectId});

        if (!lecture) throw 'Lecture not found';

        lecture._id = lecture._id.toString();

        return lecture;
    } catch (e) {
        if (e.message === 'Lecture not found') throw e;
        if (e instanceof ObjectId.TypeError) throw 'Invalid lecture ID format';
        throw `Error retrieving lecture: ${e.message}`;
    }
};

export default {
    createLecture,
    updateLecture,
    insertRating,
    getLectureById
}