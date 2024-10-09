var express = require("express");
var router = express.Router();
var multer = require("multer");
const storage = multer.memoryStorage()
const upload = multer({ storage: storage });
const csv = require('csv-parser')
const fs = require('fs')
const streamifier = require("streamifier");
const ejs = require('ejs');


const MathCourse = require("../models/MathCourse");
const MathExam = require("../models/MathExam");
const MathSection = require("../models/MathSection");
const PostedGrades = require("../models/PostedGrades");
const Course = require("../models/Course");
const CourseMember = require("../models/CourseMember");
const User = require("../models/User");

const admins = ["tjhickey@brandeis.edu","rtorrey@brandeis.edu","merrill2@brandeis.edu"]
const instructors 
  = admins.concat(
  [ "timhickey@me.com",
    "tjhickey@brandeis.edu",
    "rocklykleining@brandeis.edu",
    "mkrumpak@brandeis.edu",
    "sreshtav@brandeis.edu",
    "polyanabenk@brandeis.edu",
    "johnmfigueroa@brandeis.edu",
    "ewhyman@brandeis.edu",
    "ngoregaokar@brandeis.edu",
    "jjfang@brandeis.edu",
    "rtorrey@brandeis.edu",
    "merrill2@brandeis.edu",
    "hou@brandeis.edu",
    "vneckrasov@brandeis.edu",
    "aleighton@brandeis.edu",
    ])

/*
  Authentication middleware:
*/


// route middleware to make sure a user is logged in
const isLoggedIn = (req, res, next) => {
  res.locals.loggedIn = false;
  if (req.isAuthenticated()) {
    res.locals.loggedIn = true;
    res.locals.isAdmin = admins.includes(req.user.googleemail);
    res.locals.isInstructor = instructors.includes(req.user.googleemail);
    console.dir(['in isLoggedIn',req.user.googleemail,res.locals.isAdmin,res.locals.isInstructor]);
    return next();
  } else {
    res.redirect("/login");
  }
}

const hasCourseAccess = (req, res, next) => {
  const studentId = req.user._id;
  const courseId = req.params.courseId;
  const member = CourseMember.findOne({studentId,courseId});
  console.dir(['hasCourseAccess',member]);
  if (member) {
    next()
  } else {
    res.json({message:"you do not have access to this course"});
  }
}

const hasStaffAccess = (req, res, next) => {
  if (instructors.includes(req.user.googleemail)) {
    next();
  } else {
    res.json({message:"you are not an instructor"});
  }
}

const hasAdminAccess = (req, res, next) => {
  if (admins.includes(req.user.googleemail)) {
    next();
  } else {
    res.json({message:"you are not an admin"});
  }
}

/* Only logged in users can access the Math Grades App*/

router.use(isLoggedIn);


/* GET home page. */
router.get("/", isLoggedIn,
 async function (req, res, next) {
  let courses = [];
  if (res.locals.isAdmin || res.locals.isInstructor) {
    courses = await MathCourse.find({});
  } else {
    studentCourses = await PostedGrades.find({email:req.user.googleemail}).distinct('courseId');
    courses = await MathCourse.find({_id:{$in:studentCourses}});
  }
  res.locals.courses = courses;
  res.render("mathgrades/mathindex");
});

/*
  /showCourse goes to two different view, 
  depending on whether the user is an instructor/admin or a student
*/

router.get("/showCourse/:courseId",isLoggedIn,
 async (req,res,next) => {
  const courseId = req.params.courseId;
  if (!res.locals.isInstructor) {
    res.redirect("/mathgrades/showStudentCourse/"+ courseId );
  }else {
    const course = await MathCourse.findOne({_id:courseId})
    const mlaCourse = await Course.findOne({coursePin:course.coursePinMLA});
    res.locals.mlaCourse = mlaCourse;
    res.locals.course = course;
    res.locals.results = [];

    const exams = await MathExam.find({courseId:courseId}).sort({name:1});
    res.locals.exams = exams;
    if (course.coursePinMLA) {
      const mlaCourse = await Course.findOne({coursePin:course.coursePinMLA});
      res.locals.mlaCourse = mlaCourse;
    }
    res.locals.roster= await MathSection.find({courseId:courseId});
    console.dir(['in showCourse',res.locals.roster]);
    //res.json(course);
    res.render('mathgrades/showCourse');
  }

});

router.get("/showRoster/:courseId",isLoggedIn,
  async (req,res,next) => {
    const courseId = req.params.courseId;
    const roster = await MathSection.find({courseId:courseId});
    res.locals.memberList = roster;
    res.locals.roster= await MathSection.find({courseId:courseId});
    console.dir(['in showRoster',res.locals.roster]);
    res.render('mathgrades/showRoster');
  }
);

/* any logged in user can access their student view of a course */

router.get("/showStudentCourse/:courseId",isLoggedIn,
 async (req,res,next) => {
  /* shows link to the student's page for this course */
  const courseId = req.params.courseId;
  const course = await MathCourse.findOne({_id:courseId})
  const mlaCourseId = course.mlaCourseId;
  res.locals.course = course;
  res.locals.results = [];
  const exams = await ProblemSet.find({courseId:mlaCourseId});
  res.locals.exams = exams;
  if (exams.length == 0) {
    res.json({message:"no exams for this course yet"});
  } else {
    const examId = exams[0]._id;
    const courseId = exams[0].courseId;
    const grades = await PostedGrades.find({email:req.user.googleemail,
                                         courseId:mlaCourseId});
    res.locals.roster="";

    if (grades.length != 0) {
      const gradeId = grades[0]._id;
      res.json([grades]);
      //res.redirect(`/mathgrades/showStudent/${courseId}/${examId}/${gradeId}`);
    }
    else {
      res.json({message:"no grades for this course yet"});
    }
  }
  //res.json(course);
  //res.render('mathgrades/showCourse');
});


/*
This middleware creates res.locals.skillCounts, which is a dictionary
indexed by skill name, whose values are the number of students who have
mastered that skill. It also creates res.locals.studentCount, which is
the number of students who have been graded for the course.
*/
const getClassGrades = async (req,res,next) => {
  const courseId = req.params.courseId;
  // const examId = req.params.examId;
  const grades = await PostedGrades.find({courseId:courseId});
  const sections = await MathSection.find({courseId:courseId,section:{$ne:""}});
  const enrolledStudents = sections.map(section => section.email);

  /*
    create a dictionary which gives the number of students
    who have mastered each skill, indexed by skill name
  */
  const skillCounts = {};
  const skillMastery = {};  // list of students who have mastered each skill
  let studentCount = 0;
  let studentEmails = [];
  for (let grade of grades) {
    if (!enrolledStudents.includes(grade.email)) {
      continue;}
    // count all students who have been graded for this course
    if (!studentEmails.includes(grade.email)) {
        studentEmails.push(grade.email);
        studentCount += 1;
      }

    for (let skill of grade.skillsMastered) {
      
      if (skillCounts[skill]) {
        if (!skillMastery[skill].includes(grade.email)) {
          skillMastery[skill].push(grade.email);
          skillCounts[skill] += 1;
        }
        
      } else {
        skillMastery[skill] = [grade.email];
        skillCounts[skill] = 1;
      }
    }
  }
  res.locals.skillCounts = skillCounts;
  res.locals.studentCount = studentCount;
  console.dir(['in getClassGrades',skillCounts,studentCount,skillMastery])


  next()
}

/*
  Any student or instructor can see the grades for a given student
  on a given exam. We don't need the examId and ideally should
  just include the student's email in the URL...
  but we would need to make sure that the user is the student
  or a staff member to see the page.
*/
router.get("/showStudent/:courseId/:examId/:gradesId", isLoggedIn,
            getClassGrades,
            async (req,res,next) => {
  const courseId = req.params.courseId;
  const course = await MathCourse.findOne({_id:courseId});
  const examId = req.params.examId;
  const exam = await MathExam.findOne({_id:examId});
  const gradesId = req.params.gradesId;
  let grade = await PostedGrades.findOne({_id:gradesId});
  if (!grade) {
    grade={};
  }
  const grades = 
    await PostedGrades.find({email:grade.email,
                           courseId:courseId})
                    .populate('examId');
  // find all students in the course by section
  // if a student drops the course, they will not be in the section list                           
  const sections = await MathSection.find({courseId:courseId});
  const studentEmails = sections.map(section => section.email);
  /*
    Here is where we make sure only 
    the student or an instructor/admin 
    can see the page with the students grades
  */
  if ((req.user.googleemail == grade.email) || (instructors.includes(req.user.googleemail))) {
      res.locals.course = course;
      //res.locals.exam = exam;
      //res.locals.grade = grade;
      res.locals.name = grade.name;
      res.locals.email = grade.email;
      res.locals.grades = grades;
      let skillsMastered = [];
      let allSkills = [];
      let numFskills = 0;
      let numGskills = 0;
      for (let grade of grades) {
        skillsMastered = skillsMastered.concat(grade.skillsMastered);
        allSkills = allSkills.concat(grade.skillsMastered).concat(grade.skillsSkipped);       
      }
      allSkills = [...new Set(allSkills)].sort(compareExams);
      res.locals.allSkills = allSkills;

      res.locals.skillsMastered = 
        [...new Set(skillsMastered)].sort(compareExams);
      res.locals.numFskills = res.locals.skillsMastered.filter(skill => skill[0] == "F").length;
      res.locals.numGskills = res.locals.skillsMastered.filter(skill => skill[0] == "G").length;
      
      res.render('mathgrades/showStudent');
} else {
  res.json({message:"you are not authorized to view this page"});
}})

router.get("/showExamToStudent/:courseId/:examId", isLoggedIn, hasCourseAccess,
  async (req,res,next) => {
     const studentId = req.user._id;
     const courseId = req.params.courseId;
     const course = await MathCourse.findOne({_id:courseId});
     const examId = req.params.examId;
     const exam = await MathExam.findOne({_id:examId});
     res.locals.course = course;
     res.locals.exam = exam;
     const grades = await PostedGrades.find({examId:examId,studentId:studentId});
     res.locals.grades = grades;
     res.json(grades);
     //res.render('mathgrades/showExam');
 })
 

/* ********************************************************** */
// only admins and instructors can access the remaining routes
/* ********************************************************** */
router.use(hasStaffAccess);



router.get("/showCourse2/:courseId", hasAdminAccess,
 async (req,res,next) => {
    const courseId = req.params.courseId;
    const course = await MathCourse.findOne({_id:courseId})
    res.locals.course = course;
    res.locals.results = [];
    const exams = await MathExam.find({courseId:courseId});
    res.locals.exams = exams;
    //res.json(course);
    res.locals.roster = await MathSection.find({courseId:courseId});
    console.dir(res.locals.roster);
    res.render('mathgrades/showCourse');
});

const compareSkills = (a,b) => {
  if (a[0] < b[0]) {
    return -1;
  } else if (a[0] > b[0]) {
    return 1;
  } else {
    let n1 = parseInt(a.slice(1));
    let n2 = parseInt(b.slice(1));
    if (n1 < n2) {
      return -1;
    } else if (n1 > n2) {
      return 1;
    } else {
      return 0;
    }
  }
} 

const calculateMastery = (grades) => {
  /* 
  for each student, calculate the set of skills mastered.
  return a dictionary indexed by student emails, 
  whose values are dictionaries of skills mastered by that student,
  indexed by skill name whose values are 1.0 if it was mastered and 0.0
  if it was not mastered
  */
  const mastery = {};
  let skillSet = new Set();
  for (let grade of grades) {
      const email = grade.email;

      

      if (!mastery[email]){
        mastery[email] = {name:grade.name};
      }
      (grade.skillsMastered).forEach(skill => {
        skillSet.add(skill);
        mastery[email][skill] = 1.0;
      }
      );
      (grade.skillsSkipped).forEach(skill => {
        if (!mastery[email][skill]) {
          mastery[email][skill] = 0.0;
        }
      });
  }
  for (let email in mastery) {
    /* calculate number of F skills and G skills and
       add these as keys to the mastery dictionary */
    mastery[email]["Fskills"] = 0;
    mastery[email]["Gskills"] = 0;
    for (let skill in mastery[email]) {
      if ((skill[0] == "F") 
          && (skill != "Fskills")
          && (mastery[email][skill] == 1.0)) {
        mastery[email]["Fskills"] += 1;
      }
      if ((skill[0] == "G")
          && (skill != "Gskills")
          && (mastery[email][skill] == 1.0)) {
        mastery[email]["Gskills"] += 1;
      }
    }
  }
  skillSet = [...skillSet];
  skillSet = skillSet.sort(compareSkills);
  return [skillSet,mastery];
}

const masteryCSVtemplate =
`name,email,section,Fskills,Gskills,<% for (let skill in skillSet) { %><%= 
    skillSet[skill] %>,<% } %>
<% for (let email in mastery) { %><%= 
    mastery[email]['name'] %>,<%= 
    email %>,<%= 
    sectionDict[email] %>,<%=
    mastery[email]['Fskills'] %>,<%= 
    mastery[email]['Gskills'] %>,<% 
    for (let skill of skillSet) { 
                        let m =mastery[email][skill];
                        if (m === undefined) {
                            m = 0;
                        }
                        %><%= 
        m %>, <% } %>
<% } %>
`;


router.get("/showMastery/:courseId", hasStaffAccess, getClassGrades,
 async (req,res,next) => {
  console.log('in showMastery');
  const courseId = req.params.courseId;
  const course = await MathCourse.findOne({_id:courseId});
  const csv = req.query.csv;
  res.locals.course = course;
  const grades = await PostedGrades.find({courseId:courseId});
  const sections = await MathSection.find({courseId:courseId});
  const sectionDict = {};
  for (let section of sections) {
    sectionDict[section.email] = section.section;
  }
  res.locals.sectionDict = sectionDict;
  res.locals.grades = grades;
  [res.locals.skillSet,res.locals.mastery] = calculateMastery(grades); 
  console.dir(['showMastery',res.locals.skillSet,res.locals.mastery]);
  if (csv){ 
    res.set('Content-Type', 'text/csv');
    res.send(ejs.render(masteryCSVtemplate,res.locals));
  } else {
    //res.json([res.locals.skillSet,res.locals.mastery])
    res.render('mathgrades/showMastery'); 
  }
})

/*
this shows the mastery table but restricted to those students who didn't
take the specified exam.
*/
router.get("/showMakeupMastery/:courseId/:examId", hasStaffAccess, getClassGrades,
  async (req,res,next) => {
    const courseId = req.params.courseId;
    const examId = req.params.examId;
    const csv = req.query.csv;

    const grades = 
      await PostedGrades
          .find({examId:examId,skillsMastered:[],skillsSkipped:[]}); 
    const course = await MathCourse.findOne({_id:courseId});
    const exam = await MathExam.findOne({_id:examId});
      
    const sections = await MathSection.find({courseId:courseId});
    const sectionDict = {};
    for (let section of sections) {
      sectionDict[section.email] = section.section;
    }
    res.locals.course = course;
    res.locals.exam = exam;
    res.locals.grades = grades;
    res.locals.sectionDict = sectionDict;
    [res.locals.skillSet,res.locals.mastery] = calculateMastery(grades); 
    
    if (csv){ 
      res.set('Content-Type', 'text/csv');
      res.send(ejs.render(masteryCSVtemplate,res.locals));
    } else {
      //res.json(grades);
      res.render('mathgrades/showMastery');
    }
 })

 
router.get("/showExam/:courseId/:examId", hasStaffAccess,
 async (req,res,next) => {
    const courseId = req.params.courseId;
    const course = await MathCourse.findOne({_id:courseId});
    const examId = req.params.examId;
    const exam = await MathExam.findOne({_id:examId});
    res.locals.course = course;
    res.locals.exam = exam;
    const grades = await PostedGrades.find({examId:examId});
    res.locals.grades = grades;
    res.render('mathgrades/showExam');
})






/* ********************************************************** */
// only admins can access the remaining routes
/* ********************************************************** */
router.use(hasAdminAccess);


router.get("/deleteExam/:courseId/:examId", hasAdminAccess,
 async (req,res,next) => {
    const courseId = req.params.courseId;
    const examId = req.params.examId;
    const exam = await MathExam.findOne({_id:examId});
    await PostedGrades.deleteMany({examId:examId});
    await exam.remove();
    res.redirect(`/mathgrades/showCourse/${courseId}`);
});

function compareExams(a, b) {
  if (a[0]<b[0]) {
    return -1;
  } else if (a[0]>b[0]) {
    return 1;
  } else if (a[0]==b[0]) {
    let n1 = parseInt(a.slice(1));
    let n2 = parseInt(b.slice(1));
    if (n1<n2) {
      return -1;
    } else if (n1>n2) {
      return 1;
    } else {
      return 0;
    } 
  }
  return 0;
}

const trimSkillString = (skill) => {
  /* The name of the	skill is of the	form:
 "2: F1 (1.0 pts)": "0.0",
 so we can extrat the string from the first ":" to the first "("
 and then trim it to get	the skill name.
*/
  let firstColon = skill.indexOf(":");
  let firstParen = skill.indexOf("(");
  if (firstParen == -1) firstParen=skill.length;

  const skillName = skill.substring(firstColon+1,firstParen).trim();
  if (skillName == ''){
    console.log(`empty skill name for skill:${skill}`);
  }
  return skillName;
}

const processSkills = (grades) => {
    const skillsMastered = [];
    const skillsSkipped = [];
    for (let key in grades) {
        if (
                 (grades[key] === "1.0")  
              && (!key.includes("points"))
              && (!key.includes("Honor Pledge"))
              && (!key.includes("Total Score"))
              && (!key.includes("Max Points"))
              && (!key.includes("Count"))
            ) {
            skillsMastered.push(trimSkillString(key));
        } else if ((grades[key] === "0.0") 
                  && trimSkillString(key) != "" 
                  && (!key.includes("Honor Pledge")) 
                  && (!key.includes("Total Score"))) {
            skillsSkipped.push(trimSkillString(key));
        }
    }
    return {skillsMastered,skillsSkipped};
}

            
router.post("/uploadGrades/:courseId", hasStaffAccess,
  upload.single('grades'),
 async (req, res, next) => {

    const courseId = req.params.courseId;
    const course = await MathCourse.findOne({_id:courseId})
    res.locals.course = course;


    const examname = req.body.examname;
    /*
    read the uploaded csv file and update the grades
    */

    const { buffer, originalname } = req.file;

  const dataFromRows = [];

  streamifier
    .createReadStream(buffer)
    .pipe(csv()) //.parse({ headers: true, ignoreEmpty: true })) // <== this is @fast-csv/parse!!
    .on("data", (row) => {
      dataFromRows .push(row);
    })
    .on("end", async (rowCount) => {
      try {
        // create a new exam
        const examJSON = {
            name: examname,
            filename:originalname,
            courseId: courseId,
            createdAt: new Date(),

        }
        const exam = new MathExam(examJSON);
        await exam.save();
        const examId = exam._id;

        let documents = []
        dataFromRows.forEach(async (row) => {
            if (!row.Name) return; // skip empty rows

            const email = row.Email;
            const name = row.Name;


            const {skillsMastered,skillsSkipped} = processSkills(row);

            // create new PostedGrades object
            const gradeJSON = {              
                name: name,
                email: email,   
                courseId: courseId,
                examId: examId,
                skillsMastered: skillsMastered,
                skillsSkipped: skillsSkipped,
                createdAt: new Date(),
                grades: row
            }
            documents.push(gradeJSON);
 

        });
        await PostedGrades.insertMany(documents); 
        //res.json({ rowCount, dataFromRows });
      } catch (error) {
        console.log(error);
        //res.json({ error});
      }
    });

 //res.json({message:"grades uploaded"});
 res.redirect(`/mathgrades/showCourse/${courseId}`);
});

router.post("/linkMLACourse/:courseId", hasStaffAccess,
 async (req, res, next) => {
    const courseId = req.params.courseId;
    const course = await MathCourse.findOne({_id:courseId});
    course.coursePinMLA = req.body.coursePinMLA;
    const mlaCourse = await Course.findOne({coursePin:course.coursePinMLA});
    if (mlaCourse) {
      mlaCourse.mathCourseId = courseId;
      await mlaCourse.save();
      await course.save();
    }
    
    res.redirect(`/mathgrades/showCourse/${courseId}`);
 });

const updateCourseMembers = async (mathSectionDocuments) => {
  /*
    for each student in the section, update the courseMember collection.
    First lookup their user id in the User collection, then 
    use the mathcourseId to lookup their MLA courseId in the Course collection.
    Then update the courseMember collection with the new section and role.
    and generate a list of their userIds. 
    Finally, change the role of all students in the course
    who are not in the section to "dropped".
    When the sectionData is uploaded this is the official list of students
    in the class.
  */
  let userIds = [];
  let mathCourse = {}; // will be the MathCourse object from the section docs
  for (let sectionMember of mathSectionDocuments) {
    // update section data for existing students
    // and add new students to the CourseMember collection
    const email = sectionMember.email;
    const mathCourseId = sectionMember.courseId;
    mathCourse = await MathCourse.findOne({_id:mathCourseId});
    const mlaCourse = await Course.findOne({_id:mathCourse.courseId});
    let user = await User.findOne({googleemail:email});
    if (!user) {
      // create a new user with the email as the googleemail
      const userJSON = {
        googleemail:email,
        googlename:sectionMember.name,
        createdAt: new Date(),
      }
      user = new User(userJSON);
      user = await user.save();
    }
    userIds.push(user._id);
    let courseMember 
        = await CourseMember.findOne(
                  {studentId:user._id,
                    courseId:mlaCourse._id});
    if (courseMember) {
      // update their section and role if they are in the class
      courseMember.section = sectionMember.section;
      courseMember.role = 'student';
      courseMember = await courseMember.save();
    } else {
      // add them to the class
      const courseMemberJSON = {
        studentId:user._id,
        courseId:mlaCourse._id,
        section:sectionMember.section,
        role:"student",
        createdAt: new Date(),
      }
      courseMember = new CourseMember(courseMemberJSON);
      courseMember = await courseMember.save();
    }
  }
    
  // for all users in the course who are not in the section, 
  // change their role to "dropped"
  const courseMembers = 
    await CourseMember.updateMany(
      {courseId:mathCourse.courseId,studentId:{$nin:userIds},role:"student"},
    {$set:{role:"dropped"}});


}

router.post("/uploadSectionData/:courseId", hasStaffAccess,
  upload.single('sections'),
 async (req, res, next) => {

    const courseId = req.params.courseId;
    const course = await MathCourse.findOne({_id:courseId})
    res.locals.course = course;


    /*
    read the uploaded csv file and update the grades
    */

    const { buffer, originalname } = req.file;

  const dataFromRows = [];

  streamifier
    .createReadStream(buffer)
    .pipe(csv()) //.parse({ headers: true, ignoreEmpty: true })) // <== this is @fast-csv/parse!!
    .on("data", (row) => {
      dataFromRows .push(row);
    })
    .on("end", async (rowCount) => {
      try {

        // read section data
        let documents = []
        dataFromRows.forEach(async (row) => {
            const email = row.email;
            const name = row.name;
            const section = row.section;

            // create new PostedGrades object
            const sectionJSON = {              
                name: name,
                email: email,  
                section: section,
                courseId: courseId,
                createdAt: new Date(),
            }
            documents.push(sectionJSON);


        });
        await MathSection.deleteMany({courseId:courseId});
        await MathSection.insertMany(documents); 
        await updateCourseMembers(documents); // use section Data to update CourseMembers
        //res.json({ rowCount, dataFromRows });
      } catch (error) {
        console.log(error);
        //res.json({ error});
      }
    });

 //res.json({message:"grades uploaded"});
 res.redirect(`/mathgrades/showCourse/${courseId}`);
});

router.get("/createCourse", hasAdminAccess, 
  async function (req, res, next) {
     res.render("mathgrades/createCourse");
   });
 
 router.post("/createCourse", hasAdminAccess,
  async (req, res, next)=> {
     const courseJSON = {
         name:req.body.name,
         description:req.body.description,
         createdAt: new Date(),
         ownerId:req.user._id,
     }
     const course = new MathCourse(courseJSON);
     await course.save()
     res.redirect("/mathgrades");
 //    res.json(courseJSON);
   });

router.post("/renameCourse/:courseId", hasAdminAccess,
  async (req, res, next) => {
    const courseId = req.params.courseId;
    const course = await MathCourse.findOne({_id:courseId});
    course.name = req.body.courseName;
    await course.save();
    res.redirect("/mathgrades");
  });

    

module.exports = router;
