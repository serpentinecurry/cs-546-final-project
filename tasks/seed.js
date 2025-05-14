import { dbConnection, closeConnection } from "../config/mongoConnection.js";
import {
  userData,
  courseData,
  lectureData,
  attendanceData,
} from "../data/index.js";
import discussionsData from "../data/discussions.js";
import {
  users,
  courses,
  lectures,
  discussions,
  attendance,
  messages,
} from "../config/mongoCollections.js";
import { ObjectId } from "mongodb";
import { clearAllCalendars } from ".././services/clearAllCalendars.js";

await clearAllCalendars();

const db = await dbConnection();
await db.dropDatabase();

console.log("Starting to seed database...");

const usersCollection = await users();
const coursesCollection = await courses();
const lecturesCollection = await lectures();
const discussionsCollection = await discussions();
const attendanceCollection = await attendance();
const messagesCollection = await messages();

console.log("Creating admin user...");
const adminInfo = await userData.createUser(
  "Anik",
  "Doshi",
  "male",
  "admin@scholorio.com",
  "Admin@911",
  "admin",
  "1990-01-01",
  ""
);
await usersCollection.updateOne(
  { email: "admin@scholorio.com" },
  { $set: { accessStatus: "approved" } }
);
const admin = await userData.getUserByEmail("admin@scholario.com");

console.log("Creating professors...");
const professors = [];
const professorData = [
  {
    firstName: "Patrick",
    lastName: "Hill",
    email: "phill@stevens.edu",
    gender: "male",
  },
  {
    firstName: "Zumrat",
    lastName: "Ackam",
    email: "zackam@stevens.edu",
    gender: "female",
  },
  {
    firstName: "Johnggi",
    lastName: "Hong",
    email: "jhong@stevens.edu",
    gender: "male",
  },
  {
    firstName: "Miranda",
    lastName: "Zhang",
    email: "mzhang@stevens.edu",
    gender: "female",
  },
];

for (const prof of professorData) {
  const profInfo = await userData.createUser(
    prof.firstName,
    prof.lastName,
    prof.gender,
    prof.email,
    "Password@123",
    "professor",
    "1975-01-01",
    ""
  );
  await usersCollection.updateOne(
    { email: prof.email },
    { $set: { accessStatus: "approved" } }
  );
  const professor = await userData.getUserByEmail(prof.email);
  professors.push(professor);
}

console.log("Creating students...");
const students = [];
const studentData = [
  {
    firstName: "Sarah",
    lastName: "Lynn",
    email: "slynn@stevens.edu",
    major: "Computer Science",
    gender: "female",
    birthdate: "1997-05-10",
  },
  {
    firstName: "John",
    lastName: "Castepoint",
    email: "jcastepoint@stevens.edu",
    major: "Computer Science",
    gender: "male",
    birthdate: "1998-02-15",
  },
  {
    firstName: "Priya",
    lastName: "Sharma",
    email: "psharma@stevens.edu",
    major: "Computer Engineering",
    gender: "female",
    birthdate: "1999-08-22",
  },
  {
    firstName: "Michael",
    lastName: "Rodriguez",
    email: "mrodriguez@stevens.edu",
    major: "Computer Science",
    gender: "male",
    birthdate: "1997-11-30",
  },
  {
    firstName: "Emma",
    lastName: "Watson",
    email: "ewatson@stevens.edu",
    major: "Computer Engineering",
    gender: "female",
    birthdate: "1998-04-15",
  },
  {
    firstName: "Jamal",
    lastName: "Washington",
    email: "jwashington@stevens.edu",
    major: "Data Science",
    gender: "male",
    birthdate: "1999-01-05",
  },
  {
    firstName: "Sophia",
    lastName: "Chen",
    email: "schen@stevens.edu",
    major: "Computer Science",
    gender: "female",
    birthdate: "1997-07-12",
  },
  {
    firstName: "Aiden",
    lastName: "Nguyen",
    email: "anguyen@stevens.edu",
    major: "Computer Engineering",
    gender: "male",
    birthdate: "1998-09-18",
  },
  {
    firstName: "Olivia",
    lastName: "Martinez",
    email: "omartinez@stevens.edu",
    major: "Data Science",
    gender: "female",
    birthdate: "1999-03-25",
  },
  {
    firstName: "Ethan",
    lastName: "Kim",
    email: "ekim@stevens.edu",
    major: "Computer Science",
    gender: "male",
    birthdate: "1997-12-08",
  },
  {
    firstName: "Isabella",
    lastName: "Johnson",
    email: "ijohnson@stevens.edu",
    major: "Computer Science",
    gender: "female",
    birthdate: "1998-06-30",
  },
  {
    firstName: "Noah",
    lastName: "Garcia",
    email: "ngarcia@stevens.edu",
    major: "Computer Engineering",
    gender: "male",
    birthdate: "1999-10-17",
  },
  {
    firstName: "Zoe",
    lastName: "Williams",
    email: "zwilliams@stevens.edu",
    major: "Data Science",
    gender: "female",
    birthdate: "1997-02-09",
  },
  {
    firstName: "Lucas",
    lastName: "Brown",
    email: "lbrown@stevens.edu",
    major: "Computer Science",
    gender: "male",
    birthdate: "1998-08-14",
  },
  {
    firstName: "Ava",
    lastName: "Jones",
    email: "ajones@stevens.edu",
    major: "Computer Engineering",
    gender: "female",
    birthdate: "1999-04-20",
  },
  {
    firstName: "Mason",
    lastName: "Davis",
    email: "mdavis@stevens.edu",
    major: "Data Science",
    gender: "male",
    birthdate: "1997-09-27",
  },
  {
    firstName: "Charlotte",
    lastName: "Miller",
    email: "cmiller@stevens.edu",
    major: "Computer Science",
    gender: "female",
    birthdate: "1998-11-05",
  },
  {
    firstName: "Liam",
    lastName: "Wilson",
    email: "lwilson@stevens.edu",
    major: "Computer Engineering",
    gender: "male",
    birthdate: "1999-05-12",
  },
  {
    firstName: "Amelia",
    lastName: "Anderson",
    email: "aanderson@stevens.edu",
    major: "Data Science",
    gender: "female",
    birthdate: "1997-08-19",
  },
  {
    firstName: "Benjamin",
    lastName: "Taylor",
    email: "btaylor@stevens.edu",
    major: "Computer Science",
    gender: "male",
    birthdate: "1998-01-25",
  },
];

for (const student of studentData) {
  const studentInfo = await userData.createUser(
    student.firstName,
    student.lastName,
    student.gender,
    student.email,
    "Password@123",
    "student",
    student.birthdate,
    student.major
  );
  await usersCollection.updateOne(
    { email: student.email },
    { $set: { accessStatus: "approved" } }
  );
  const student_obj = await userData.getUserByEmail(student.email);
  students.push(student_obj);
}

console.log("Creating courses...");
const coursesList = [
  { name: "Web Development", code: "CS-546", professor: professors[0] },
  {
    name: "Database Management Systems",
    code: "CS-542",
    professor: professors[0],
  },
  {
    name: "Human Computer Interaction",
    code: "CS-545",
    professor: professors[1],
  },
  {
    name: "Intro to Computer Science",
    code: "CS-501",
    professor: professors[1],
  },
  {
    name: "Intro to Machine Learning",
    code: "CS-559",
    professor: professors[2],
  },
  { name: "Data Structures", code: "CS-570", professor: professors[2] },
  { name: "Computer Networks", code: "CS-555", professor: professors[3] },
  { name: "Software Engineering", code: "CS-554", professor: professors[3] },
];

const courseIds = {};
for (const course of coursesList) {
  const courseInfo = await courseData.createCourse(
    course.name,
    course.code,
    course.professor._id.toString()
  );
  const allCourses = await courseData.getAllCourses();
  const createdCourse = allCourses.find((c) => c.courseCode === course.code);
  courseIds[course.code] = createdCourse._id.toString();
}

console.log("Adding course schedules...");
for (const course of coursesList) {
  const daysMap = {
    "CS-546": [{ day: "Monday" }, { day: "Wednesday" }],
    "CS-542": [{ day: "Tuesday" }, { day: "Thursday" }],
    "CS-545": [{ day: "Monday" }, { day: "Wednesday" }],
    "CS-501": [{ day: "Tuesday" }, { day: "Friday" }],
    "CS-559": [{ day: "Wednesday" }, { day: "Friday" }],
    "CS-570": [{ day: "Tuesday" }, { day: "Thursday" }],
    "CS-555": [{ day: "Monday" }, { day: "Thursday" }],
    "CS-554": [{ day: "Thursday" }, { day: "Friday" }],
  };

  const timeMap = {
    "CS-546": [
      { startTime: "10:00", endTime: "11:50" },
      { startTime: "10:00", endTime: "11:50" },
    ],
    "CS-542": [
      { startTime: "14:00", endTime: "15:50" },
      { startTime: "14:00", endTime: "15:50" },
    ],
    "CS-545": [
      { startTime: "12:00", endTime: "13:50" },
      { startTime: "12:00", endTime: "13:50" },
    ],
    "CS-501": [
      { startTime: "09:00", endTime: "10:50" },
      { startTime: "09:00", endTime: "10:50" },
    ],
    "CS-559": [
      { startTime: "15:00", endTime: "16:50" },
      { startTime: "15:00", endTime: "16:50" },
    ],
    "CS-570": [
      { startTime: "11:00", endTime: "12:50" },
      { startTime: "11:00", endTime: "12:50" },
    ],
    "CS-555": [
      { startTime: "16:00", endTime: "17:50" },
      { startTime: "16:00", endTime: "17:50" },
    ],
    "CS-554": [
      { startTime: "13:00", endTime: "14:50" },
      { startTime: "13:00", endTime: "14:50" },
    ],
  };

  await coursesCollection.updateOne(
    { _id: new ObjectId(courseIds[course.code]) },
    {
      $set: {
        courseMeetingDays: daysMap[course.code],
        courseMeetingTime: timeMap[course.code],
      },
    }
  );
}

console.log("Creating lectures...");
const lectureMap = {};

for (const course of coursesList) {
  const courseId = courseIds[course.code];
  const lectureTopics = [];

  switch (course.name) {
    case "Web Development":
      lectureTopics.push(
        {
          title: "Course Introduction & Syllabus",
          desc: "Overview of web development fundamentals and course expectations",
          date: "2025-09-02",
        },
        {
          title: "HTML & CSS Fundamentals",
          desc: "Learning the building blocks of web pages",
          date: "2025-09-09",
        },
        {
          title: "JavaScript Basics",
          desc: "Introduction to programming with JavaScript",
          date: "2025-09-16",
        },
        {
          title: "Learning AJAX",
          desc: "Working with asynchronous JavaScript and XML",
          date: "2025-09-23",
        }
      );
      break;
    case "Database Management Systems":
      lectureTopics.push(
        {
          title: "Introduction to Database Systems",
          desc: "Overview of database concepts and architecture",
          date: "2025-09-03",
        },
        {
          title: "SQL Fundamentals",
          desc: "Learning basic SQL queries and operations",
          date: "2025-09-10",
        },
        {
          title: "Normalization",
          desc: "Database normalization and design principles",
          date: "2025-09-17",
        },
        {
          title: "Transactions & Concurrency",
          desc: "Managing database transactions",
          date: "2025-09-24",
        }
      );
      break;
    case "Human Computer Interaction":
      lectureTopics.push(
        {
          title: "Introduction to HCI",
          desc: "Overview of human-computer interaction principles",
          date: "2025-09-02",
        },
        {
          title: "User Research Methods",
          desc: "Techniques for understanding user needs and behaviors",
          date: "2025-09-09",
        },
        {
          title: "Usability Testing",
          desc: "Methods for evaluating interface usability",
          date: "2025-09-16",
        },
        {
          title: "Interaction Design",
          desc: "Principles and patterns for designing interfaces",
          date: "2025-09-23",
        }
      );
      break;
    case "Intro to Computer Science":
      lectureTopics.push(
        {
          title: "Computing Fundamentals",
          desc: "Introduction to computing concepts and terminology",
          date: "2025-09-03",
        },
        {
          title: "Basic Programming Concepts",
          desc: "Variables, control structures, and functions",
          date: "2025-09-10",
        },
        {
          title: "Data Representation",
          desc: "How computers store and represent data",
          date: "2025-09-17",
        },
        {
          title: "Algorithms & Complexity",
          desc: "Introduction to algorithm design and analysis",
          date: "2025-09-24",
        }
      );
      break;
    case "Intro to Machine Learning":
      lectureTopics.push(
        {
          title: "ML Fundamentals",
          desc: "Introduction to machine learning concepts",
          date: "2025-09-04",
        },
        {
          title: "Linear Regression",
          desc: "Understanding linear models for prediction",
          date: "2025-09-11",
        },
        {
          title: "Classification Algorithms",
          desc: "Techniques for categorizing data",
          date: "2025-09-18",
        },
        {
          title: "Gradient Descent",
          desc: "Optimization methods for machine learning models",
          date: "2025-09-25",
        }
      );
      break;
    case "Data Structures":
      lectureTopics.push(
        {
          title: "Introduction to Data Structures",
          desc: "Overview of fundamental data structures",
          date: "2025-09-03",
        },
        {
          title: "Arrays & Linked Lists",
          desc: "Implementation and operations of basic structures",
          date: "2025-09-10",
        },
        {
          title: "Trees & Graphs",
          desc: "Hierarchical and network data structures",
          date: "2025-09-17",
        },
        {
          title: "Hashing & Hash Tables",
          desc: "Efficient data retrieval techniques",
          date: "2025-09-24",
        }
      );
      break;
    case "Computer Networks":
      lectureTopics.push(
        {
          title: "Network Fundamentals",
          desc: "Introduction to computer networking concepts",
          date: "2025-09-02",
        },
        {
          title: "Network Protocols",
          desc: "Understanding communication protocols",
          date: "2025-09-09",
        },
        {
          title: "Routing & Addressing",
          desc: "How data finds its way through networks",
          date: "2025-09-16",
        },
        {
          title: "Network Security",
          desc: "Protection against threats and vulnerabilities",
          date: "2025-09-23",
        }
      );
      break;
    case "Software Engineering":
      lectureTopics.push(
        {
          title: "Software Development Lifecycle",
          desc: "Phases and methodologies of software development",
          date: "2025-09-04",
        },
        {
          title: "Requirements Engineering",
          desc: "Gathering and analyzing software requirements",
          date: "2025-09-11",
        },
        {
          title: "Software Design",
          desc: "Principles and patterns of software architecture",
          date: "2025-09-18",
        },
        {
          title: "Testing & QA",
          desc: "Ensuring software quality and reliability",
          date: "2025-09-25",
        }
      );
      break;
  }

  lectureMap[course.code] = [];

  for (const topic of lectureTopics) {
    const courseDetails = await coursesCollection.findOne({
      _id: new ObjectId(courseId),
    });
    const startTime = courseDetails.courseMeetingTime[0].startTime;
    const endTime = courseDetails.courseMeetingTime[0].endTime;

    const lecture = await lectureData.createLecture(
      courseId,
      topic.title,
      topic.date,
      startTime,
      endTime,
      topic.desc,
      `https://scholorio.com/materials/${course.code}/${topic.title
        .toLowerCase()
        .replace(/\s+/g, "-")}`
    );

    lectureMap[course.code].push({
      id: lecture.lectureId,
      title: topic.title,
      date: topic.date,
    });
  }
}

console.log("Assigning TAs...");
const taAssignments = {};
const taIndex = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
let taCounter = 0;

for (const course of coursesList) {
  const ta1 = students[taIndex[taCounter]];
  const ta2 = students[taIndex[taCounter + 1]];
  taCounter += 2;

  await usersCollection.updateOne(
    { _id: ta1._id },
    {
      $set: { role: "ta" },
      $addToSet: { taForCourses: new ObjectId(courseIds[course.code]) },
    }
  );

  await usersCollection.updateOne(
    { _id: ta2._id },
    {
      $set: { role: "ta" },
      $addToSet: { taForCourses: new ObjectId(courseIds[course.code]) },
    }
  );

  taAssignments[course.code] = [ta1, ta2];
}

console.log("Enrolling students in courses...");
const courseAssignments = {
  16: ["CS-546", "CS-545", "CS-559"],
  17: ["CS-542", "CS-501", "CS-570"],
  18: ["CS-555", "CS-554", "CS-546"],
  19: ["CS-545", "CS-559", "CS-570"],
};

for (const studentIndex in courseAssignments) {
  const studentCourses = courseAssignments[studentIndex];
  for (const courseCode of studentCourses) {
    await coursesCollection.updateOne(
      { _id: new ObjectId(courseIds[courseCode]) },
      {
        $push: {
          studentEnrollments: {
            studentId: students[studentIndex]._id,
            status: "active",
            requestedAt: new Date(),
          },
        },
      }
    );
  }
}

for (const courseCode in taAssignments) {
  for (const ta of taAssignments[courseCode]) {
    await coursesCollection.updateOne(
      { _id: new ObjectId(courseIds[courseCode]) },
      {
        $push: {
          studentEnrollments: {
            studentId: ta._id,
            status: "active",
            requestedAt: new Date(),
          },
        },
      }
    );
  }
}

console.log("Creating pending enrollment requests...");
const pendingRequests = [
  { student: students[16], course: "CS-542" },
  { student: students[17], course: "CS-545" },
  { student: students[18], course: "CS-501" },
  { student: students[19], course: "CS-542" },
  { student: students[16], course: "CS-554" },
];

for (const request of pendingRequests) {
  await coursesCollection.updateOne(
    { _id: new ObjectId(courseIds[request.course]) },
    {
      $push: {
        studentEnrollments: {
          studentId: request.student._id,
          status: "pending",
          requestedAt: new Date(),
        },
      },
    }
  );
}

console.log("Adding professor office hours...");

const professorCourseOfficeHours = {
  "CS-546": {
    day: "Monday",
    startTime: "13:00",
    endTime: "14:30",
    location: "CASE 430",
    notes: "Drop by with any questions about web development.",
  },
  "CS-542": {
    day: "Wednesday",
    startTime: "10:30",
    endTime: "12:00",
    location: "CASE 422",
    notes: "Project consultations and database concepts.",
  },
  "CS-545": {
    day: "Tuesday",
    startTime: "14:00",
    endTime: "15:30",
    location: "CASE 410",
    notes: "Office hours for HCI project discussion.",
  },
  "CS-501": {
    day: "Friday",
    startTime: "11:00",
    endTime: "12:30",
    location: "CASE 415",
    notes: "Help with intro concepts and programming fundamentals.",
  },
  "CS-559": {
    day: "Wednesday",
    startTime: "15:00",
    endTime: "16:30",
    location: "CASE 450",
    notes: "Available for ML model discussions.",
  },
  "CS-570": {
    day: "Thursday",
    startTime: "13:30",
    endTime: "15:00",
    location: "CASE 455",
    notes: "Implementation help for data structures.",
  },
  "CS-555": {
    day: "Monday",
    startTime: "16:00",
    endTime: "17:30",
    location: "CASE 440",
    notes: "Network concepts and troubleshooting help.",
  },
  "CS-554": {
    day: "Thursday",
    startTime: "09:00",
    endTime: "10:30",
    location: "CASE 445",
    notes: "Software architecture and design patterns.",
  },
};

for (const course of coursesList) {
  const courseId = courseIds[course.code];
  const officeHour = professorCourseOfficeHours[course.code];

  if (officeHour) {
    await courseData.addProfessorOfficeHour(courseId, officeHour);
  }
}

console.log("Adding TA office hours...");
for (const courseCode in taAssignments) {
  const courseId = courseIds[courseCode];
  const tas = taAssignments[courseCode];
  const taDays = ["Tuesday", "Wednesday"];

  for (let i = 0; i < tas.length; i++) {
    const ta = tas[i];
    const day = taDays[i];
    const officeHour = {
      taId: ta._id,
      taName: `${ta.firstName} ${ta.lastName}`,
      day: day,
      startTime: "14:00",
      endTime: "15:00",
      location: `Library, Floor ${i + 1}`,
      notes: "Help with assignments and lab work.",
    };

    await coursesCollection.updateOne(
      { _id: new ObjectId(courseId) },
      {
        $push: {
          taOfficeHours: officeHour,
        },
      }
    );
  }
}

console.log("Creating attendance records...");
const attendanceStatuses = [
  "present",
  "present",
  "present",
  "absent",
  "excused",
];
for (const courseCode in lectureMap) {
  const courseId = courseIds[courseCode];

  const course = await coursesCollection.findOne({
    _id: new ObjectId(courseId),
  });
  const enrolledStudents = course.studentEnrollments
    .filter((enrollment) => enrollment.status === "active")
    .map((enrollment) => enrollment.studentId);

  for (const lecture of lectureMap[courseCode]) {
    for (let i = 0; i < enrolledStudents.length; i++) {
      const studentId = enrolledStudents[i];
      const statusIndex = i % 5;
      const status = attendanceStatuses[statusIndex];

      await attendanceData.createAttendance(
        lecture.id,
        courseId,
        studentId.toString(),
        status
      );
    }
  }
}

console.log("Creating discussions and comments...");
for (const courseCode in lectureMap) {
  const courseId = courseIds[courseCode];

  for (const lecture of lectureMap[courseCode]) {
    if (
      [
        "Learning AJAX",
        "SQL Fundamentals",
        "Gradient Descent",
        "Introduction to HCI",
      ].includes(lecture.title)
    ) {
      const course = await coursesCollection.findOne({
        _id: new ObjectId(courseId),
      });
      const professor = await usersCollection.findOne({
        _id: course.professorId,
      });

      let discussionTitle, discussionContent;

      switch (lecture.title) {
        case "Learning AJAX":
          discussionTitle = "Questions about AJAX Implementation";
          discussionContent =
            "Let's discuss any challenges or questions you have about implementing AJAX in your projects.";
          break;
        case "SQL Fundamentals":
          discussionTitle = "SQL Query Help Thread";
          discussionContent =
            "Post your SQL query problems here and we'll help troubleshoot them.";
          break;
        case "Gradient Descent":
          discussionTitle = "Understanding Gradient Descent Algorithm";
          discussionContent =
            "What are the key challenges you're facing in understanding the gradient descent algorithm?";
          break;
        case "Introduction to HCI":
          discussionTitle = "Discussing User Interface Design Principles";
          discussionContent =
            "How do you apply these principles in real applications?";
          break;
      }

      const discussion = await discussionsData.createDiscussion(
        lecture.id,
        courseId,
        professor._id.toString(),
        discussionTitle,
        discussionContent
      );

      const courseStudents = course.studentEnrollments
        .filter((enrollment) => enrollment.status === "active")
        .map((enrollment) => enrollment.studentId);

      const studentCommenters = [courseStudents[0], courseStudents[1]];

      const comments = [
        {
          commenterId: professor._id,
          comment:
            "Please share your questions about the topics covered in the lecture.",
        },
        {
          commenterId: studentCommenters[0],
          comment:
            lecture.title === "Gradient Descent"
              ? "I'm struggling to understand how to set the learning rate. When should we use a smaller vs. larger learning rate?"
              : "Could you explain how we should structure our project deliverables?",
        },
        {
          commenterId: professor._id,
          comment:
            lecture.title === "Gradient Descent"
              ? "The key to understanding gradient descent is to visualize it as walking down a hill, taking steps proportional to the slope at each point."
              : "Great question! Please refer to the rubric I posted on the course website.",
        },
      ];

      for (const commentData of comments) {
        await discussionsData.addAComment(
          discussion._id.toString(),
          courseId,
          commentData.commenterId.toString(),
          commentData.comment,
          false
        );
      }
    }
  }
}

console.log("Creating messages between students and TAs...");
for (const courseCode in taAssignments) {
  const courseId = courseIds[courseCode];
  const tas = taAssignments[courseCode];

  const course = await coursesCollection.findOne({
    _id: new ObjectId(courseId),
  });
  const studentEnrollments = course.studentEnrollments
    .filter((enrollment) => enrollment.status === "active")
    .filter((enrollment) => {
      return !tas.some(
        (ta) => ta._id.toString() === enrollment.studentId.toString()
      );
    });

  if (studentEnrollments.length === 0) continue;

  if (studentEnrollments.length >= 2) {
    const messagingStudents = [studentEnrollments[0], studentEnrollments[1]];

    for (const enrollment of messagingStudents) {
      const studentId = enrollment.studentId;
      const ta = tas[0];

      await messagesCollection.insertOne({
        fromId: studentId,
        toId: ta._id,
        courseId: new ObjectId(courseId),
        subject: `Question about ${courseCode} assignment`,
        message:
          "I'm having trouble understanding the requirements for the upcoming assignment. Could you clarify what's expected for the third part?",
        sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        read: true,
      });

      await messagesCollection.insertOne({
        fromId: ta._id,
        toId: studentId,
        courseId: new ObjectId(courseId),
        subject: `Re: Question about ${courseCode} assignment`,
        message:
          "I'd be happy to help clarify the assignment requirements. The third part is asking you to implement the algorithm we discussed in lecture using the data structure of your choice.",
        sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        read: false,
      });
    }
  }
}

console.log("Database seeded successfully!");
await closeConnection();
