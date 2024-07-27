var express = require("express");
var router = express.Router();
var multer = require("multer");
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })
const csv = require('csv-parser')
const fs = require('fs')
const streamifier = require("streamifier");


const MathCourse = require("../models/MathCourse");
const MathExam = require("../models/MathExam");
const MathGrades = require("../models/MathGrades");

/* GET home page. */
router.get("/", async function (req, res, next) {
  const courses = await MathCourse.find({});
  res.locals.courses = courses;
  res.render("mathgrades/mathindex");
});

router.get("/createCourse", async function (req, res, next) {
    res.render("mathgrades/createCourse");
  });

router.post("/createCourse", async (req, res, next)=> {
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

router.get("/showCourse/:courseId",async (req,res,next) => {
    const courseId = req.params.courseId;
    const course = await MathCourse.findOne({_id:courseId})
    res.locals.course = course;
    res.locals.results = [];
    console.log(`courseId:${courseId} course:${course}`)
    const exams = await MathExam.find({courseId:courseId});
    res.locals.exams = exams;
    console.log(exams);
    //res.json(course);
    res.render('mathgrades/showCourse');
});

router.get("/showExam/:courseId/:examId",async (req,res,next) => {
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

router.get("/deleteExam/:courseId/:examId",async (req,res,next) => {
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

router.get("/showStudent/:courseId/:examId/:gradesId",async (req,res,next) => {
    const courseId = req.params.courseId;
    const course = await MathCourse.findOne({_id:courseId});
    const examId = req.params.examId;
    const exam = await MathExam.findOne({_id:examId});
    const gradesId = req.params.gradesId;
    const grade = await MathGrades.findOne({_id:gradesId});
    const grades = 
      await MathGrades.find({email:grade.email,
                             courseId:courseId});
    res.locals.course = course;
    res.locals.exam = exam;
    res.locals.grade = grade;
    res.locals.grades = grades;
    let skillsMastered = [];
    let allSkills = [];
    for (let grade of grades) {
      console.log(grade.skillsMastered);
      skillsMastered = skillsMastered.concat(grade.skillsMastered);
      allSkills = allSkills.concat(grade.skillsMastered).concat(grade.skillsSkipped); 
    }
    allSkills = [...new Set(allSkills)].sort(compareExams);
    res.locals.allSkills = allSkills;
    console.log(`grades:${grades}`);
    console.log(`skillsMastered:${skillsMastered}`);
    res.locals.skillsMastered = 
       [...new Set(skillsMastered)].sort(compareExams);
    console.log(res.locals.skillsMastered);
    res.render('mathgrades/showStudent');
})


const trimSkillString = (skill) => {
  /* The name of the	skill is of the	form:
 "2: F1 (1.0 pts)": "0.0",
 so we can extrat the string from the first ":" to the first "("
 and then trim it to get	the skill name.
*/
  const firstColon = skill.indexOf(":");
  const firstParen = skill.indexOf("(");
  const skillName = skill.substring(firstColon+1,firstParen).trim();
  return skillName;
}

const processSkills = (grades) => {
    const skillsMastered = [];
    const skillsSkipped = [];
    for (let key in grades) {
        if ((grades[key] === "1.0") && (key.includes(": "))) {
            skillsMastered.push(trimSkillString(key));
        } else if ((grades[key] === "0.0") && (!key.includes("Honor Pledge"))) {
            skillsSkipped.push(trimSkillString(key));
        }
    }
    return {skillsMastered,skillsSkipped};
}

            
router.post("/uploadGrades/:courseId", upload.single('grades'),
  async (req, res, next) => {

    const courseId = req.params.courseId;
    const course = await MathCourse.findOne({_id:courseId})
    res.locals.course = course;
    console.log(`courseId:${courseId} course:${course}`)
    console.log(req.file);

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
        console.log(`examId:${examId}`);

        let documents = []
        dataFromRows.forEach(async (row) => {
            const email = row.Email;
            const name = row.Name;
            console.log(`email:${email} name:${name}`)
            const {skillsMastered,skillsSkipped} = processSkills(row);
            console.log(`skillsMastered:${skillsMastered} skillsSkipped:${skillsSkipped}`);

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
