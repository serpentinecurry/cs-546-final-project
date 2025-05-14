import { ObjectId } from "mongodb";
import { feedback } from "../config/mongoCollections.js";

export const createFeedbackSurvey = async (courseId, professorId) => {
  if (!courseId || !professorId) throw "CourseId and ProfessorId Required";

  const feedbackCollection = await feedback();

  const newSurvey = {
    courseId: new ObjectId(courseId),
    professorId: new ObjectId(professorId),
    content: [
      {
        question1: "What did you enjoy about this course?",
        question2: "What did you not enjoy about this course?",
        question3: "What can be improved about this course?",
      },
    ],
    studentResponses: [],
    addedAt: new Date(),
  };

  const insertInfo = await feedbackCollection.insertOne(newSurvey);
  if (!insertInfo.acknowledged || !insertInfo.insertedId)
    throw "Could not create feedback survey";

  return { success: true, id: insertInfo.insertedId };
};

export default { createFeedbackSurvey };
