var express = require("express");
var router = express.Router();
var multer = require("multer");
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })
const csv = require('csv-parser')
const fs = require('fs')
const streamifier = require("streamifier");
const ejs = require('ejs');


const MathCourse = require("../models/MathCourse");
const MathExam = require("../models/MathExam");
const MathGrades = require("../models/MathGrades");

const admins = ["tjhickey@brandeis.edu","rtorrey@brandeis.edu","merrill2@brandeis.edu"]
const instructors = admins.concat(["timhickey@me.com"])

/*
  Authentication middleware:
*/


// route middleware to make sure a user is logged in
const isLoggedIn = (req, res, next) => {
  res.locals.loggedIn = false;
  if (req.isAuthenticated()) {
    res.locals.loggedIn = true;
    req.isAdmin = admins.includes(req.user.googleemail);
    req.isInstructor = instructors.includes(req.user.googleemail);
    console.log(`isAdmin:${req.isAdmin} isInstructor:${req.isInstructor}`);
    return next();
  } else {
    res.redirect("/login");
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
  studentCourses = await MathGrades.find({email:req.user.googleemail}).distinct('courseId');
  console.log(`studentCourses:${studentCourses}`);
  const courses = await MathCourse.find({_id:{$in:studentCourses}});
  res.locals.courses = courses;
  res.locals.isAdmin = req.isAdmin;
  res.render("mathgrades/mathindex");
});

/*
  /showCourse goes to two different view, 
  depending on whether the user is an instructor/admin or a student
*/

router.get("/showCourse/:courseId",isLoggedIn,
 async (req,res,next) => {
  const courseId = req.params.courseId;
  if (!req.isInstructor) {
    res.redirect("/mathgrades/showStudentCourse/"+ courseId );
  }else {
    const course = await MathCourse.findOne({_id:courseId})
    res.locals.course = course;
    res.locals.results = [];
    console.log(`courseId:${courseId} course:${course}`)
    console.log(`isAdmin:${req.isAdmin} isInstructor:${req.isInstructor}`);
    const exams = await MathExam.find({courseId:courseId});
    res.locals.exams = exams;
    res.locals.isAdmin = req.isAdmin;
    //console.log(exams);
    //res.json(course);
    res.render('mathgrades/showCourse');
  }

});

/* any logged in user can access the student view of a course */

router.get("/showStudentCourse/:courseId",isLoggedIn,
 async (req,res,next) => {
  /* shows link to the student's page for this course */
  const courseId = req.params.courseId;
  const course = await MathCourse.findOne({_id:courseId})
  res.locals.course = course;
  res.locals.results = [];
  //console.log(`courseId:${courseId} course:${course}`)
  const exams = await MathExam.find({courseId:courseId});
  res.locals.exams = exams;
  res.locals.isAdmin = req.isAdmin;
  //console.log(exams);
  if (exams.length == 0) {
    res.json({message:"no exams for this course yet"});
  } else {
    const examId = exams[0]._id;
    const courseId = exams[0].courseId;
    const grades = await MathGrades.find({email:req.user.googleemail,
                                         courseId:courseId});
    if (grades.length != 0) {
      const gradeId = grades[0]._id;
      res.redirect(`/mathgrades/showStudent/${courseId}/${examId}/${gradeId}`);
    }
    else {
      res.json({message:"no grades for this course yet"});
    }
  }
  //res.json(course);
  //res.render('mathgrades/showCourse');
});

const getClassGrades = async (req,res,next) => {
  //console.log('in getClassGrades');
  const courseId = req.params.courseId;
  // const examId = req.params.examId;
  const grades = await MathGrades.find({courseId:courseId});
  /*
    create a dictionary which gives the number of students
    who have mastered each skill, indexed by skill name
  */
  const skillCounts = {};
  const skillMastery = {};  // list of students who have mastered each skill
  let studentCount = 0;
  let studentEmails = [];
  for (let grade of grades) {
    
    for (let skill of grade.skillsMastered) {
      if (!studentEmails.includes(grade.email)) {
        studentEmails.push(grade.email);
        studentCount += 1;
      }
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
  //console.dir(`skillCounts.keys:${Object.keys(skillCounts)}`);
  //console.dir(`skillCounts.values:${Object.values(skillCounts)}`);
  //console.log(`studentCount:${studentCount}`);


  next()
}

router.get("/showStudent/:courseId/:examId/:gradesId", isLoggedIn,
            getClassGrades,
            async (req,res,next) => {
  const courseId = req.params.courseId;
  const course = await MathCourse.findOne({_id:courseId});
  const examId = req.params.examId;
  const exam = await MathExam.findOne({_id:examId});
  const gradesId = req.params.gradesId;
  const grade = await MathGrades.findOne({_id:gradesId});
  const grades = 
    await MathGrades.find({email:grade.email,
                           courseId:courseId});
  /*
    Here is where we make sure only 
    the student or an instructor/admin 
    can see the page with the students grades
  */
  if ((req.user.googleemail == grade.email) || (instructors.includes(req.user.googleemail))) {
      res.locals.course = course;
      res.locals.exam = exam;
      res.locals.grade = grade;
      res.locals.grades = grades;
      let skillsMastered = [];
      let allSkills = [];
      let numFskills = 0;
      let numGskills = 0;
      for (let grade of grades) {
        //console.log(grade.skillsMastered);
        skillsMastered = skillsMastered.concat(grade.skillsMastered);
        allSkills = allSkills.concat(grade.skillsMastered).concat(grade.skillsSkipped); 
      }
      allSkills = [...new Set(allSkills)].sort(compareExams);
      res.locals.allSkills = allSkills;
      //console.log(`grades:${grades}`);
      //console.log(`skillsMastered:${skillsMastered}`);
      res.locals.skillsMastered = 
        [...new Set(skillsMastered)].sort(compareExams);
      res.locals.numFskills = res.locals.skillsMastered.filter(skill => skill[0] == "F").length;
      res.locals.numGskills = res.locals.skillsMastered.filter(skill => skill[0] == "G").length;
      
      res.render('mathgrades/showStudent');
} else {
  res.json({message:"you are not authorized to view this page"});
}})

router.use((req, res, next) => {
  if (!admins.includes(req.user.googleemail)) {
    res.json({message:"you are not an admin"});
  }else {
    next();
  }
})

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

router.get("/showCourse/:courseId", hasAdminAccess,
 async (req,res,next) => {
    const courseId = req.params.courseId;
    const course = await MathCourse.findOne({_id:courseId})
    res.locals.course = course;
    res.locals.results = [];
    //console.log(`courseId:${courseId} course:${course}`)
    const exams = await MathExam.find({courseId:courseId});
    res.locals.exams = exams;
    //console.log(exams);
    //res.json(course);
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
      //console.log(`grades.skillsMastered:${grade.skillsMastered}`);
      (grade.skillsMastered).forEach(skill => {
        skillSet.add(skill);
        mastery[email][skill] = 1.0;
      }
      );
      for (let skill of grade.skillsSkipped) {
        if (!mastery[email][skill]) {
          mastery[email][skill] = 0.0;
        }
      }
  }
  for (let email in mastery) {
    /* calculate number of F skills and G skills and
       add these as keys to the mastery dictionary */
    mastery[email]["Fskills"] = 0;
    mastery[email]["Gskills"] = 0;
    for (let skill in mastery[email]) {
      if ((skill[0] == "F") && (mastery[email][skill] == 1.0)) {
        mastery[email]["Fskills"] += 1;
      }
      if ((skill[0] == "G")&& (mastery[email][skill] == 1.0)) {
        mastery[email]["Gskills"] += 1;
      }
    }
  }
  skillSet = [...skillSet];
  skillSet = skillSet.sort(compareSkills);
  return [skillSet,mastery];
}

const masteryCSVtemplate =
`name,email,Fskills,Gskills,<% for (let skill in skillSet) { %><%= 
    skillSet[skill] %>,<% } %>
<% for (let email in mastery) { %><%= 
    mastery[email]['name'] %>,<%= 
    email %>,<%= 
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


router.get("/showMastery/:courseId", hasStaffAccess,
 async (req,res,next) => {
  const courseId = req.params.courseId;
  const course = await MathCourse.findOne({_id:courseId});
  const csv = req.query.csv;
  res.locals.course = course;
  const grades = await MathGrades.find({courseId:courseId});
  [res.locals.skillSet,res.locals.mastery] = calculateMastery(grades); 
  console.log(res.locals.skillSet);
  if (csv){
    res.set('Content-Type', 'text/csv');
    res.send(ejs.render(masteryCSVtemplate,res.locals));
  } else {
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
    const grades = await MathGrades.find({examId:examId});
    res.locals.grades = grades;
    res.render('mathgrades/showExam');
})

router.get("/deleteExam/:courseId/:examId", hasAdminAccess,
 async (req,res,next) => {
    const courseId = req.params.courseId;
    const examId = req.params.examId;
    const exam = await MathExam.findOne({_id:examId});
    await MathGrades.deleteMany({examId:examId});
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
  const firstColon = skill.indexOf(":");
  const firstParen = skill.indexOf("(");
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
        if ((grades[key] === "1.0") && (key.includes(": "))) {
            skillsMastered.push(trimSkillString(key));
        } else if ((grades[key] === "0.0") 
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
    //console.log(`courseId:${courseId} course:${course}`)
    //console.log(req.file);

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
        //console.log(`examId:${examId}`);

        let documents = []
        dataFromRows.forEach(async (row) => {
            const email = row.Email;
            const name = row.Name;
            //console.log(`email:${email} name:${name}`)
            const {skillsMastered,skillsSkipped} = processSkills(row);
            //console.log(`skillsMastered:${skillsMastered} skillsSkipped:${skillsSkipped}`);

            // create new MathGrades object
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
            //const grade = new MathGrades(gradeJSON);
            //console.log(gradeJSON);
            //const grade = new MathGrades(gradeJSON);
            //await grade.save();

        });
        await MathGrades.insertMany(documents); 
        //res.json({ rowCount, dataFromRows });
      } catch (error) {
        console.log(error);
        //res.json({ error});
      }
    });

 //res.json({message:"grades uploaded"});
 res.redirect(`/mathgrades/showCourse/${courseId}`);
});
    

module.exports = router;
