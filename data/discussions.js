import { ObjectId } from "mongodb";
import { stringValidate } from "../validation.js";
import { courses, lectures, discussions } from "../config/mongoCollections.js";

const createDiscussion = async (
  lectureId,
  courseId,
  authorId,
  postTitle,
  postContent
) => {
  lectureId = stringValidate(lectureId);
  courseId = stringValidate(courseId);
  authorId = stringValidate(authorId);
  postTitle = stringValidate(postTitle);
  postContent = stringValidate(postContent);

  if (!lectureId || !courseId || !authorId || !postTitle || !postContent) {
    throw "All fields are required";
  }

  if (!ObjectId.isValid(lectureId)) {
    throw "Invalid Lecture ID";
  }
  if (!ObjectId.isValid(courseId)) {
    throw "Invalid Course ID";
  }
  if (!ObjectId.isValid(authorId)) {
    throw "Invalid Author ID";
  }

  const courseCollection = await courses();
  const course = await courseCollection.findOne({
    _id: new ObjectId(courseId),
  });
  if (!course) {
    throw "Course not found";
  }

  const lecturesCollection = await lectures();
  const lecture = await lecturesCollection.findOne({
    _id: new ObjectId(lectureId),
  });

  if (!lecture) {
    throw "Lecture not found";
  }

  if (lecture.courseId.toString() !== courseId) {
    throw "This Lecture does not belong to this Course!";
  }

  const discussionsCollection = await discussions();

  const existingDiscussion = await discussionsCollection.findOne({
    lectureId: new ObjectId(lectureId),
    courseId: new ObjectId(courseId),
  });

  if (existingDiscussion) {
    return {
      _id: existingDiscussion._id.toString(),
      lectureId: existingDiscussion.lectureId.toString(),
      courseId: existingDiscussion.courseId.toString(),
      authorId: existingDiscussion.authorId.toString(),
      postTitle: existingDiscussion.postTitle,
      postContent: existingDiscussion.postContent,
      comments: existingDiscussion.comments || [],
      createdAt: existingDiscussion.createdAt,
      updatedAt: existingDiscussion.updatedAt,
      alreadyExists: true,
    };
  }

  const discussion = {
    lectureId: new ObjectId(lectureId),
    courseId: new ObjectId(courseId),
    authorId: new ObjectId(authorId),
    postTitle: postTitle,
    postContent: postContent,
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const insertResult = await discussionsCollection.insertOne(discussion);

  if (!insertResult.acknowledged) {
    throw "Could not create discussion";
  }

  return {
    _id: insertResult.insertedId.toString(),
    lectureId: discussion.lectureId.toString(),
    courseId: discussion.courseId.toString(),
    authorId: discussion.authorId.toString(),
    postTitle: discussion.postTitle,
    postContent: discussion.postContent,
    comments: [],
    createdAt: discussion.createdAt,
    updatedAt: discussion.updatedAt,
    alreadyExists: false,
  };
};

const getDiscussionsLecture = async (lectureId, courseId) => {
  lectureId = stringValidate(lectureId);
  courseId = stringValidate(courseId);

  if (!ObjectId.isValid(lectureId)) {
    throw "Invalid lecture ID";
  }
  if (!ObjectId.isValid(courseId)) {
    throw "Invalid course ID";
  }

  const courseCollection = await courses();
  const course = await courseCollection.findOne({
    _id: new ObjectId(courseId),
  });

  if (!course) {
    throw "Course not found";
  }

  const discussionsCollection = await discussions();
  const lectureDiscussions = await discussionsCollection
    .find({
      lectureId: new ObjectId(lectureId),
      courseId: new ObjectId(courseId),
    })
    .toArray();

  return lectureDiscussions.map((discussion) => ({
    _id: discussion._id.toString(),
    lectureId: discussion.lectureId.toString(),
    courseId: discussion.courseId.toString(),
    authorId: discussion.authorId.toString(),
    postTitle: discussion.postTitle,
    postContent: discussion.postContent,
    comments: discussion.comments || [],
    createdAt: discussion.createdAt,
    updatedAt: discussion.updatedAt,
  }));
};

const addAComment = async (
  discussionId,
  courseId,
  commenterId,
  commentText = false
) => {
  discussionId = stringValidate(discussionId);
  courseId = stringValidate(courseId);
  commenterId = stringValidate(commenterId);
  commentText = stringValidate(commentText);

  if (!ObjectId.isValid(discussionId)) {
    throw "Invalid Discussion ID";
  }
  if (!ObjectId.isValid(courseId)) {
    throw "Invalid Course ID";
  }
  if (!ObjectId.isValid(commenterId)) {
    throw "Invalid Commenter ID";
  }

  const comment = {
    _id: new ObjectId(),
    commenterId: new ObjectId(commenterId),
    isAnonymous: false,
    commentText: commentText,
    timestamp: new Date(),
  };

  const discussionsCollection = await discussions();
  const updateResult = await discussionsCollection.updateOne(
    {
      _id: new ObjectId(discussionId),
      courseId: new ObjectId(courseId),
    },
    {
      $push: { comments: comment },
      $set: { updatedAt: new Date() },
    }
  );

  if (updateResult.matchedCount === 0) {
    throw "Discussion not found";
  }

  if (updateResult.modifiedCount === 0) {
    throw "Failed to add comment";
  }

  return {
    _id: comment._id.toString(),
    commenterId: comment.commenterId.toString(),
    isAnonymous: false,
    commentText: comment.commentText,
    timestamp: comment.timestamp,
  };
};

export default {
  createDiscussion,
  getDiscussionsLecture,
  addAComment,
};
