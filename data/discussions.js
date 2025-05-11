import { ObjectId } from "mongodb";
import {
  stringValidate,
  parse12HourTime,
  isStartBeforeEnd,
  isValid24Hour,
} from "../validation.js";
import { users, courses, lectures } from "../config/mongoCollections.js";



// {
//     "_id": "ObjectId_discussion",
//     "lectureId": "ObjectId_lecture",
//     "authorId": "ObjectId_student",
//     "postTitle": "Confused about Fetch API chaining",
//     "postContent": "Can someone explain the difference between .then() and                                         async/await?",
//     "comments": [{
//         "commenterId": "ObjectId_student2",
//         "isAnonymous": false,
//         "commentText": "You can think of .then() as chaining promises!",
//         "timestamp": "timestamp"
//       }],
//     "createdAt": "timestamp",
//     "updatedAt": "timestamp"
//   }
  




// create a discussion
const createDiscussion = async (lectureId, courseId, authorId, postTitle, postContent) => {
    // Input validation remains the same
    lectureId = stringValidate(lectureId);
    courseId = stringValidate(courseId);
    authorId = stringValidate(authorId);
    postTitle = stringValidate(postTitle);
    postContent = stringValidate(postContent);
    
    if (!lectureId || !courseId || !authorId || !postTitle || !postContent) {
        throw "All fields are required";
    }

    if (!ObjectId.isValid(lectureId)) {
        throw "Invalid lecture ID";
    }
    if (!ObjectId.isValid(courseId)) {
        throw "Invalid course ID";
    }
    if (!ObjectId.isValid(authorId)) {
        throw "Invalid author ID";
    }

    // First check that the course exists
    const courseCollection = await courses();
    const course = await courseCollection.findOne({
        _id: new ObjectId(courseId)
    });
    if (!course) {
        throw "Course not found";
    }
    
    // Modified lecture check: Don't require courseId in the same document
    const lecturesCollection = await lectures();
    const lecture = await lecturesCollection.findOne({
        _id: new ObjectId(lectureId)
    });
    
    if (!lecture) {
        throw "Lecture not found";
    }
    
    // Check if lecture belongs to this course
    if (lecture.courseId.toString() !== courseId) {
        throw "Lecture does not belong to this course";
    }
    
    // Check if a discussion already exists for this lecture
    const existingDiscussion = course.discussions?.find(
        disc => disc.lectureId.toString() === lectureId
    );
    
    if (existingDiscussion) {
        return {
            _id: existingDiscussion._id.toString(),
            lectureId: existingDiscussion.lectureId.toString(),
            authorId: existingDiscussion.authorId.toString(),
            postTitle: existingDiscussion.postTitle,
            postContent: existingDiscussion.postContent,
            comments: existingDiscussion.comments || [],
            createdAt: existingDiscussion.createdAt,
            updatedAt: existingDiscussion.updatedAt,
            alreadyExists: true
        };
    }
    
    // Create discussion object following the schema
    const discussion = {
        _id: new ObjectId(),
        lectureId: new ObjectId(lectureId),
        authorId: new ObjectId(authorId),
        postTitle: postTitle,
        postContent: postContent,
        comments: [],
        createdAt: new Date(),
        updatedAt: new Date()
    };
    
    // Add discussion to course
    const updateInfo = await courseCollection.updateOne(
        { _id: new ObjectId(courseId) },
        {
            $push: {
                discussions: discussion,
            },
        }
    );
    
    if (updateInfo.modifiedCount === 0) {
        throw "Could not create discussion";
    }
    
    return {
        _id: discussion._id.toString(),
        lectureId: discussion.lectureId.toString(),
        authorId: discussion.authorId.toString(),
        postTitle: discussion.postTitle,
        postContent: discussion.postContent,
        comments: [],
        createdAt: discussion.createdAt,
        updatedAt: discussion.updatedAt,
        alreadyExists: false
    };
}


// get all discussions for lecture

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
        _id: new ObjectId(courseId)
    });
    
    if (!course) {
        throw "Course not found";
    }
    
    // Filter discussions for this lecture
    const lectureDiscussions = course.discussions?.filter(
        discussion => discussion.lectureId.toString() === lectureId
    ) || [];
    
    // Don't throw if no discussions, just return empty array
    return lectureDiscussions.map(discussion => ({
        _id: discussion._id.toString(),
        lectureId: discussion.lectureId.toString(),
        authorId: discussion.authorId.toString(),
        postTitle: discussion.postTitle,
        postContent: discussion.postContent,
        comments: discussion.comments || [],
        createdAt: discussion.createdAt,
        updatedAt: discussion.updatedAt
    }));
}

const addAComment = async (discussionId, courseId, commenterId, commentText, isAnonymous = false) => {
    discussionId = stringValidate(discussionId);
    courseId = stringValidate(courseId);
    commenterId = stringValidate(commenterId);
    commentText = stringValidate(commentText);
    
    if (!ObjectId.isValid(discussionId)) {
        throw "Invalid discussion ID";
    }
    if (!ObjectId.isValid(courseId)) {
        throw "Invalid course ID";
    }
    if (!ObjectId.isValid(commenterId)) {
        throw "Invalid commenter ID";
    }
    
    const comment = {
        _id: new ObjectId(),
        commenterId: new ObjectId(commenterId),
        isAnonymous: isAnonymous,
        commentText: commentText,
        timestamp: new Date()
    };
    
    const courseCollection = await courses();
    const updateResult = await courseCollection.updateOne(
        { 
            _id: new ObjectId(courseId),
            "discussions._id": new ObjectId(discussionId)
        },
        { 
            $push: { "discussions.$.comments": comment },
            $set: { "discussions.$.updatedAt": new Date() }
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
        isAnonymous: comment.isAnonymous,
        commentText: comment.commentText,
        timestamp: comment.timestamp
    };
}

export default {
    createDiscussion,
    getDiscussionsLecture,
    addAComment
}