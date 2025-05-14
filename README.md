<h2 align="left">
  <img src="/public/images/scholario_logo.png" alt="Scholario Logo" width="130"/>
</h2>

# 📘 **Scholario Instructions**

---

### ⚙️ **Setup Instructions**

1. Run `npm i` to install all dependencies.
2. Seed the database using `npm run seed`.
3. Start the application with `npm start`.

---

### 🔐 **Login Credentials**

> ⚠️ Make sure to run the seed command (`npm run seed`) first to populate the database with these test credentials.

#### 👨‍💼 **Admin**

* 📧 [admin@scholario.com](mailto:admin@scholario.com)
* 🔑 Password: `Admin@911`

| Email                                           | Password               
| ----------------------------------------------- | ---------------------- 
| [phill@stevens.edu](mailto:phill@stevens.edu)   | ProfWebDBMS\$2025      
| [zackam@stevens.edu](mailto:zackam@stevens.edu) | ProfHCIIntro\$2025     
| [jhong@stevens.edu](mailto:jhong@stevens.edu)   | ProfMLDataStruct\$2025 

| Email                                                   | Password            
| ------------------------------------------------------- | ------------------- 
| [slynn@stevens.edu](mailto:slynn@stevens.edu)           | TAWeb546\$2025      
| [psharma@stevens.edu](mailto:psharma@stevens.edu)       | TADatabase542\$2025 
| [mrodriguez@stevens.edu](mailto:mrodriguez@stevens.edu) | TADatabase542\$2025 


| Email                                             | Password               
| ------------------------------------------------- | ---------------------- 
| [cmiller@stevens.edu](mailto:cmiller@stevens.edu) | StudentCharlotte\$2025 
| [lwilson@stevens.edu](mailto:lwilson@stevens.edu) | StudentLiam\$2025      
| [btaylor@stevens.edu](mailto:btaylor@stevens.edu) | StudentBenjamin\$2025  


---

### 🧪 **Testing Key Features**

#### ✅ **RBAC (Role-Based Access Control)**

* 👑 **Admin**: Create professors, assign them to courses, manage students.
* 🧑‍🏫 **Professor**: Manage courses, lectures, attendance, office hours, feedback, and students.
* 🧑‍💼 **TA**: Manage office hours, respond to student messages.
* 👨‍🎓 **Student**: Enroll in courses, track attendance, access materials and discussions.

#### 📝 **Sign-Up Flow**

* Professors **must be created by the Admin**
* <img width="468" src="https://github.com/user-attachments/assets/08387eac-48e9-4344-85d1-b54974a890c2" />


* Students can **sign up themselves** but require **Admin approval**
* <img width="468" src="https://github.com/user-attachments/assets/0c4b38bd-24cf-4a47-8a37-d491b9527565" />

---

### 📚 **Courses and Enrollment**

* 🔍 **All Courses**: Browse available courses.
* 📂 **My Courses**: View approved courses.

> 📥 Students must **request to enroll**. Professors approve these requests in **Pending Enrollment Requests**.

---

### 🧑‍🏫 **Professor Dashboard**

* 📅 Create/manage lectures
* 📌 Mark attendance (auto-email sent to absentees)
* 📈 View lecture-wise attendance analytics
* 💬 Start and manage class discussions
* 📋 Create course feedback surveys
* 🕒 Set office hours and **sync to Google Calendar**

> Ensure that discussions and surveys are created **before** students attempt to access them.

<img width="468" src="https://github.com/user-attachments/assets/fbfbd4e5-9ddb-4d60-b7e4-a9eb07593602" />
<img width="468" src="https://github.com/user-attachments/assets/f91b442b-e8e3-4ebb-925b-03ccd0facdf2" />
<img width="468" src="https://github.com/user-attachments/assets/fd6d9f16-8629-41bc-904d-6f1f04fa1cce" />

---

### 👨‍🎓 **Student Dashboard**

* 📊 View **attendance stats** and warnings (if >35% missed)
* 📚 Enroll in courses
* 📅 View lecture schedules and materials
* 🚫 Submit absence requests
* 🌟 Rate lectures (only **after** the lecture ends)
* 🔁 Sync with Google Calendar
* 🧾 Update profile info

<img width="468" src="https://github.com/user-attachments/assets/b3e94164-eeb4-41d5-83f1-9dea56f63e60" />
<img width="468" src="https://github.com/user-attachments/assets/d387f87b-b67c-4720-ba76-a7b5d9214ab5" />
<img width="468" src="https://github.com/user-attachments/assets/6c3288c2-d1b7-448d-8135-ec7f4d941c18" />

---

### 👨‍🏫 **TA Dashboard**

> 📝 TA features are available **only after office hours are set**

* ➕ Add/Delete office hours
* 📩 Respond to student messages
* Note: The TA must add their office hours for all the TA related features to work properly.

<img width="468" src="https://github.com/user-attachments/assets/0cc5be07-9a81-4e8b-a38a-6b6d4f647ce7" />

---

### 📈 **Attendance Analytics**

* 🎯 View per-lecture attendance graphs
* ❗ Absence = -1 grade point (by default)
* 📬 Absent students receive **email notifications**

> Use your own test email for full demo experience.

---

### 🗓️ **Office Hours & Calendar Sync**

* 👨‍🏫 Professors can set and edit their office hours.
* 📆 Office hours appear on the **Professor Dashboard** and sync to Google Calendar.

