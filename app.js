// Start/restart this with
// pm2 start bin/www -n mastery -i 3
// restart with
// pm2 restart mastery
// get help with
// pm2

var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
require("dotenv").config();

if (process.env.IS_ON_WEB == "False") {
  var livereload = require("livereload");
  var connectLiveReload = require("connect-livereload");
  // require the socket.io module
}
// Models!
const Course = require("./models/Course");
const ProblemSet = require("./models/ProblemSet");
const Problem = require("./models/Problem");
const Answer = require("./models/Answer");
const Review = require("./models/Review");
const User = require("./models/User");
const CourseMember = require("./models/CourseMember");
const Skill = require("./models/Skill");
const RegradeRequest = require("./models/RegradeRequest");
const ejsLint = require("ejs-lint");

if (process.env.IS_ON_WEB == "False") {
  const liveReloadServer = livereload.createServer();
  liveReloadServer.server.once("connection", () => {
    setTimeout(() => {
      liveReloadServer.refresh("/");
    }, 100);
  });
}

//const mongoose = require( 'mongoose' );
//const ObjectId = mongoose.Schema.Types.ObjectId;

//var apikey = require('./config/apikey');

// AUTHENTICATION MODULES
(session = require("express-session")), (bodyParser = require("body-parser")), (flash = require("connect-flash"));

const MongoStore = require("connect-mongo")(session);

// END OF AUTHENTICATION MODULES

const mongoose = require("mongoose");

mongoose.connect("mongodb+srv://" + process.env.MONGO_USER + ":" + process.env.MONGO_PW + "@cluster0.f3f06uz.mongodb.net/test", {useNewUrlParser: true, useUnifiedTopology: true, family: 4});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("we are connected!!!");
});

// Authentication
var GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;
// here we set up authentication with passport
const passport = require("passport");
const configPassport = require("./config/passport");
configPassport(passport);

var app = express();
if (process.env.IS_ON_WEB == "False") {
  app.use(connectLiveReload());
}

var http = require("http").Server(app);
var io = require("socket.io")(http);

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

/*************************************************************************
     HERE ARE THE AUTHENTICATION ROUTES
**************************************************************************/

//app.use(session({ secret: 'zzbbyanana',resave: false,  saveUninitialized: false }));
app.use(
  session({
    secret: "zzbbyanana",
    resave: false,
    saveUninitialized: false,
    cookie: {maxAge: 24 * 60 * 60 * 1000}, // allow login for one day...
    store: new MongoStore({mongooseConnection: mongoose.connection}),
  })
);
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

const approvedLogins = ["tjhickey724@gmail.com", "csjbs2018@gmail.com"];

// here is where we check on their logged in status
app.use((req, res, next) => {
  res.locals.title = "Peer Review App";
  res.locals.loggedIn = false;
  if (req.isAuthenticated()) {
    res.locals.user = req.user;
    res.locals.loggedIn = true;
  } else {
    res.locals.loggedIn = false;
  }
  next();
});

// here are the authentication routes

app.get("/loginerror", function (req, res) {
  res.locals.routeName = " loginerror";
  res.render("loginerror", {});
});

app.get("/login", function (req, res) {
  res.locals.routeName = " login";
  res.render("login", {});
});

// route for logging out
app.get("/logout", function (req, res) {
  req.session.destroy((error) => {
    console.log("Error in destroying session: " + error);
  });
  req.logout();
  res.redirect("/");
});

// =====================================
// GOOGLE ROUTES =======================
// =====================================
// send to google to do the authentication
// profile gets us their basic information including their name
// email gets their emails
app.get("/auth/google", passport.authenticate("google", {scope: ["profile", "email"]}));

app.get(
  "/login/authorized",
  passport.authenticate("google", {
    successRedirect: "/lrec",
    failureRedirect: "/loginerror",
  })
);

app.get("/login/local", async (req, res, next) => {
  res.locals.routeName = " login";
  res.render("localLogin");
});

app.post("/auth/local/register", function (req, res, next) {
  console.log("registering user");
  User.register(new User({googleemail: req.body.username, googlename: req.body.name}), req.body.password, function (err) {
    if (err) {
      console.log("error while user register!", err);
      // try {
      //   User.changePassword(undefined, req.body.password);
      //   User.save()
      // } catch (e) {
      // next(e);
      // }
      return next(err);
    }

    console.log("user registered!");

    res.redirect("/login/local");
  });
});

app.post("/auth/local/login", passport.authenticate("local", {failureRedirect: "/loginerror"}), function (req, res) {
  res.redirect("/lrec");
});

app.get("/lrec", async (req, res, next) => {
  try {
    //console.log("in addTA handler "+req.body.email)
    let loginer = await User.findOne({_id: req.user._id});
    if (loginer) {
      loginer.logintime = loginer.logintime || [];
      loginer.logintime.push(new Date());
      loginer.markModified("logintime");
      //console.log("updating ta "+ta._id)
      //console.dir(ta)
      await loginer.save();
    }
    res.redirect("/");
  } catch (e) {
    next(e);
  }
});

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {
  res.locals.loggedIn = false;
  if (req.isAuthenticated()) {
    res.locals.loggedIn = true;
    return next();
  } else {
    res.redirect("/login");
  }
}

app.get("/", isLoggedIn, async (req, res, next) => {
  if (!req.user) next();

  let coursesOwned = await Course.find({ownerId: req.user._id}, "name");
  res.locals.coursesOwned = coursesOwned;
  res.locals.coursesTAing = [];

  let registrations = await CourseMember.find({studentId: req.user._id}, "courseId");
  res.locals.registeredCourses = registrations.map((x) => x.courseId);

  let coursesTaken = await Course.find({_id: {$in: res.locals.registeredCourses}}, "name");
  res.locals.coursesTaken = coursesTaken;

  let coursesTAing = await Course.find({_id: {$in: req.user.taFor}});
  res.locals.coursesTAing = coursesTAing;

  res.locals.title = "PRA";

  res.locals.routeName = " index";
  res.render("index");
});

app.get("/about", (req, res, next) => {
  res.locals.routeName = " about";
  res.render("about");
});

app.get("/profile", async (req, res, next) => {
  if (res.locals.entryNum == undefined) {
    res.locals.entryNum = "all";
  }
  res.locals.routeName = " profile";
  res.render("showProfile");
});

app.post("/profile", async (req, res, next) => {
  res.locals.entryNum = req.body.enNum;
  res.locals.routeName = " profile";
  res.render("showProfile");
});

app.get("/stats", async (req, res, next) => {
  let courseCount = await Course.find().count();
  let userCount = await User.find().count();
  let problemCount = await Problem.find().count();
  let answerCount = await Answer.find().count();
  let reviewCount = await Review.find().count();
  let courses = await Course.find({}, {name: 1});
  let googleemail;
  if (typeof req.user !== "undefined") {
    googleemail = req.user.googleemail;
  } else {
    googleemail = "";
  }
  res.locals.routeName = " stats";
  res.render("stats.ejs", {courseCount, userCount, problemCount, answerCount, reviewCount, courses, googleemail});
});

app.use(isLoggedIn);

app.use((req, res, next) => {
  if (true || req.user.googleemail.endsWith("@brandeis.edu")) {
    next();
  } else {
    res.send("You must have a Brandeis email to use this Peer Review App server\n " + "You can set up your own server. The code is at http://github.com/tjhickey724/PeerReviewApp branch v2.1 ");
  }
});

app.get("/createCourse", (req, res) => {
  res.locals.routeName = " createCourse";
  res.render("createCourse");
});

// rename this to /createCourse and update the ejs form
app.post("/createNewCourse", async (req, res, next) => {
  //console.dir(req.body)
  if (false && !req.user.googleemail.endsWith("@brandeis.edu")) {
    res.send("You must log in with an @brandeis.edu account to create a class. <a href='/logout'>Logout</a>");
    return;
  } else if (!(req.body.norobot == "on" && req.body.robot == undefined)) {
    res.send("no robots allowed!");
    return;
  }
  try {
    let coursePin = await getCoursePin();
    //console.dir(req.user)
    let newCourse = new Course({
      name: req.body.courseName,
      ownerId: req.user._id,
      coursePin: coursePin,
      createdAt: new Date(),
    });

    newCourse
      .save()
      .then((a) => {
        res.redirect("/");
      })
      .catch((error) => {
        res.send(error);
      });
  } catch (e) {
    next(e);
  }
});

async function getCoursePin() {
  // this only works if there are many fewer than 10000000 courses
  // but that won't be an issue with this alpha version!
  let coursePin = Math.floor(Math.random() * 10000000);
  let lookupPin = await Course.find({coursePin: coursePin}, "coursePin");

  while (lookupPin.length > 0) {
    coursePin = Math.floor(Math.random() * 10000000);
    lookupPin = await Course.find({coursePin: coursePin}, "coursePin");
  }
  return coursePin;
}

app.get("/showRoster/:courseId", async (req, res, next) => {
  try {
    const id = req.params.courseId;
    res.locals.courseInfo = await Course.findOne({_id: id}, "name coursePin ownerId");

    const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id});
    const memberIds = memberList.map((x) => x.studentId);
    //console.log("memberIds = "+JSON.stringify(memberIds))
    res.locals.members = await User.find({_id: {$in: memberIds}});
    //console.dir(res.locals.members)
    res.locals.routeName = " showRoster";
    res.render("showRoster");
  } catch (e) {
    next(e);
  }
});

app.post("/addStudents/:courseId", async (req, res, next) => {
  try {
    const id = req.params.courseId;
    res.locals.courseInfo = await Course.findOne({_id: id}, "name coursePin ownerId");

    console.log("emails=");
    let emails = req.body.emails.split("\n").map((x) => x.trim());
    //console.log(emails)
    for (let e of emails) {
      let z = await User.findOneAndUpdate({googleemail: e}, {googleemail: e}, {upsert: true, new: true});
      console.log(e, z.googlename);
      let registration = {
        studentId: z._id,
        courseId: id,
        createdAt: new Date(),
      };
      let cm = await CourseMember.findOneAndUpdate({studentId: z._id, courseId: id}, registration, {upsert: true, new: true});

      console.log("inserted " + JSON.stringify(registration));
    }
    let users = await User.find({googleemail: {$in: emails}});
    console.log("number of users is " + users.length);

    res.redirect("/showRoster/" + id);
  } catch (e) {
    next(e);
  }
});

app.get("/showCourse/:courseId", async (req, res, next) => {
  try {
    const id = req.params.courseId;
    res.locals.courseInfo = await Course.findOne({_id: id}, "name coursePin ownerId");

    const memberList = await CourseMember.find({studentId: req.user._id, courseId: res.locals.courseInfo._id});
    res.locals.isEnrolled = memberList.length > 0;

    res.locals.problemSets = await ProblemSet.find({courseId: res.locals.courseInfo._id});

    // next we create maps to find the number of problems and user's answers
    // in each problem set so the user will know if they have finished a problemset
    let problems = await Problem.find({courseId: res.locals.courseInfo._id});
    let myAnswers = await Answer.find({courseId: res.locals.courseInfo._id, studentId: req.user._id});

    let problemMap = new Map();
    let answerMap = new Map();
    for (let problem of problems) {
      let count = problemMap.get(problem.psetId.toString());
      if (count) {
        problemMap.set(problem.psetId.toString(), count + 1);
      } else {
        problemMap.set(problem.psetId.toString(), 1);
      }
    }
    for (let answer of myAnswers) {
      let count = answerMap.get(answer.psetId.toString());
      if (count) {
        answerMap.set(answer.psetId.toString(), count + 1);
      } else {
        answerMap.set(answer.psetId.toString(), 1);
      }
    }
    res.locals.problemMap = problemMap;
    res.locals.answerMap = answerMap;

    let myReviews = await Review.find({courseId: res.locals.courseInfo._id, studentId: req.user._id});
    res.locals.myReviews = myReviews;
    let thumbsUp = 0;
    let thumbsDown = 0;
    for (let r of myReviews) {
      thumbsUp += r.upvoters.length;
      thumbsDown += r.downvoters.length;
    }
    res.locals.thumbsUp = thumbsUp;
    res.locals.thumbsDown = thumbsDown;

    res.locals.isTA = req.user.taFor && req.user.taFor.includes(res.locals.courseInfo._id);

    let fullAnswers = await Answer.find({studentId: req.user._id, courseId: id});
    answers = fullAnswers.map((x) => x._id);
    let taIds = (await User.find({taFor: id})).map((x) => x._id);

    let reviews = await Review.find({answerId: {$in: answers}, reviewerId: {$in: taIds}});
    let skillListsOLD = reviews.map((x) => x.skills);
    let skillLists = fullAnswers.map((x) => x.skills);
    let skillCount = {};
    for (slist of skillLists) {
      if (!slist) continue;
      for (s of slist) {
        skillCount[s] = (skillCount[s] || 0) + 1;
      }
    }
    console.dir(skillCount);
    res.locals.skillCount = skillCount;
    let skillIds = Array.from(new Set(flatten(skillLists)));
    res.locals.skills = await Skill.find({_id: {$in: skillIds}});
    res.locals.allSkills = await Skill.find({courseId: id});
    res.locals.skillIds = skillIds;

    res.locals.regradeRequests = await RegradeRequest.find({courseId: id, completed: false});

    res.locals.routeName = " showCourse";
    res.render("showCourse");
  } catch (e) {
    next(e);
  }
});

const flatten = (vals) => {
  let flist = [];
  for (x of vals) {
    flist = flist.concat(x);
  }
  return flist;
};

app.post("/joinCourse", async (req, res, next) => {
  try {
    let coursePin = req.body.coursePin;

    res.locals.courseInfo = await Course.findOne({coursePin: coursePin}, "name coursePin ownerId");

    const memberList = await CourseMember.find({studentId: req.user._id, courseId: res.locals.courseInfo._id});
    res.locals.isEnrolled = memberList.length > 0;

    res.locals.problemSets = await ProblemSet.find({courseId: res.locals.courseInfo._id});

    let registration = {
      studentId: res.locals.user._id,
      courseId: res.locals.courseInfo._id,
      createdAt: new Date(),
    };

    let newCourseMember = new CourseMember(registration);

    await newCourseMember.save();

    res.redirect("/showCourse/" + res.locals.courseInfo._id);
  } catch (e) {
    next(e);
  }
});

app.get("/showSkills/:courseId", async (req, res, next) => {
  try {
    res.locals.skills = await Skill.find({courseId: req.params.courseId});
    res.locals.courseId = req.params.courseId;

    res.locals.routeName = " showSkills";
    res.render("showSkills");
  } catch (e) {
    next(e);
  }
});

app.get("/addSkill/:courseId", (req, res) => {
  res.locals.courseId = req.params.courseId;

  res.locals.routeName = " addSkill";
  res.render("addSkill");
});

app.post("/addSkill", async (req, res, next) => {
  try {
    let newSkill = new Skill({
      name: req.body.name,
      description: req.body.description,
      createdAt: new Date(),
      courseId: req.body.courseId,
    });

    await newSkill.save();
    res.redirect("/showCourse/" + req.body.courseId);
  } catch (e) {
    next(e);
  }
});

app.get("/showSkill/:skillId", async (req, res, next) => {
  try {
    const skillId = req.params.skillId;
    res.locals.skillId = skillId;
    res.locals.skill = await Skill.findOne({_id: skillId});
    let courseId = res.locals.skill.courseId;
    res.locals.courseInfo = await Course.findOne({_id: courseId}, "name ownerId");
    res.locals.isOwner = res.locals.courseInfo.ownerId == req.user.id;
    res.locals.routeName = " showSkill";
    res.render("showSkill");
  } catch (e) {
    console.log("Error in showSkill: " + e);
    next(e);
  }
});

app.get("/editSkill/:skillId", async (req, res, next) => {
  try {
    const id = req.params.skillId;
    res.locals.skillId = id;
    res.locals.skill = await Skill.findOne({_id: id});
    res.locals.routeName = " editSkill";
    res.render("editSkill");
  } catch (e) {
    next(e);
  }
});

app.post("/editSkill/:skillId", async (req, res, next) => {
  try {
    const skill = await Skill.findOne({_id: req.params.skillId});

    skill.name = req.body.name;
    skill.description = req.body.description;
    skill.createdAt = new Date();

    await skill.save();

    res.redirect("/showSkill/" + req.params.skillId);
  } catch (e) {
    next(e);
  }
});

app.get("/addProblemSet/:courseId", async (req, res, next) => {
  const id = req.params.courseId;

  const courseInfo = await Course.findOne({_id: id}, "name ownerId");
  res.locals.routeName = " addProblemSet";
  res.render("addProblemSet", {name: courseInfo.name, ownerId: courseInfo.ownerId, courseId: courseInfo._id});
});

app.post("/saveProblemSet/:courseId", async (req, res, next) => {
  try {
    const id = req.params.courseId;
    let newProblemSet = new ProblemSet({
      name: req.body.name,
      courseId: id,
      createdAt: new Date(),
    });

    await newProblemSet.save();

    res.locals.courseInfo = await Course.findOne({_id: id}, "name coursePin ownerId");

    res.locals.problemSets = await ProblemSet.find({courseId: res.locals.courseInfo._id});

    res.redirect("/showCourse/" + res.locals.courseInfo._id);
  } catch (e) {
    next(e);
  }
});

app.get("/editProblemSet/:psetId", async (req, res, next) => {
  const psetId = req.params.psetId;
  res.locals.psetId = psetId;
  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  res.locals.problems = await Problem.find({psetId: psetId});
  res.locals.courseInfo = await Course.findOne({_id: res.locals.problemSet.courseId}, "ownerId");
  res.locals.routeName = " editProblemSet";
  res.render("editProblemSet");
});

app.post("/updateProblemSet/:psetId", async (req, res, next) => {
  try {
    const id = req.params.psetId;
    const pset = await ProblemSet.findOne({_id: id});
    console.log("id=" + id);
    pset.name = req.body.name;
    pset.visible = req.body.visible == "visible";
    await pset.save();

    res.redirect("/showProblemSet/" + id);
  } catch (e) {
    next(e);
  }
});

const getStudentSkills = async (studentId) => {
  try {
    const skills = await Answer.find({studentId: studentId}).distinct("skills");
    console.log(skills);
    return skills.map((c) => c.toString());
  } catch (e) {
    console.log("error in getStudentSkills");
    console.dir(e);
    throw e;
  }
};

app.get("/showProblemSet/:psetId", async (req, res, next) => {
  console.log("in showProblemSet");
  const psetId = req.params.psetId;
  res.locals.psetId = psetId;
  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  res.locals.problems = await Problem.find({psetId: psetId});
  res.locals.courseInfo = await Course.findOne({_id: res.locals.problemSet.courseId}, "ownerId");
  res.locals.myAnswers = await Answer.find({psetId: psetId, studentId: req.user._id});
  res.locals.pids = res.locals.myAnswers.map((x) => {
    return x.problemId.toString();
  });
  res.locals.skills = await getStudentSkills(req.user._id);
  console.log("pids = ");
  console.dir(res.locals.pids);
  res.locals.routeName = " showProblemSet";
  res.render("showProblemSet");
});

app.get("/gradeProblemSet/:psetId/json", async (req, res, next) => {
  const psetId = req.params.psetId;
  const problemSet = await ProblemSet.findOne({_id: psetId});
  const problems = await Problem.find({psetId: psetId});
  const answers = await Answer.find({psetId: psetId});
  const courseInfo = await Course.findOne({_id: problemSet.courseId}, "ownerId");
  const memberList = await CourseMember.find({courseId: courseInfo._id});
  const students = memberList.map((x) => x.studentId);

  const studentsInfo = await User.find({_id: {$in: students}}, {}, {sort: {googleemail: 1}});

  const taList = await User.find({taFor: courseInfo._id});
  const taIds = taList.map((x) => x._id);

  const taReviews = await Review.find({psetId: psetId, reviewerId: {$in: taIds}});

  res.locals.taReviews = taReviews;
  jsonGrades = [];
  for (i = 0; i < studentsInfo.length; i++) {
    let psetScore = 0;
    let psetCount = 0; // number of problems graded by TAs
    let jsonRow = {email: studentsInfo[i].googleemail, name: studentsInfo[i].googlename, grades: []};
    for (j = 0; j <= problems.length - 1; j++) {
      // find the scores of the reviews of this problem
      const studentAnswers = answers.filter((a) => {
        return a.studentId.equals(studentsInfo[i]._id) && a.problemId.equals(problems[j]._id);
      });

      const grades = taReviews.filter((r) => {
        let zz = r.problemId && r.problemId.equals(problems[j]._id) && r.studentId && r.studentId.equals(studentsInfo[i]._id);
        //console.log(`${zz} ${i} ${j} ${r.problemId} ${problems[j]._id} ${studentsInfo[i]._id} ${r.studentId}`)

        return zz;
      });
      answerId = null;
      if (grades.length > 0) {
        answerId = grades[0].answerId;
      }

      if (studentAnswers.length == 0) {
        jsonRow.grades.push(-1);
      } else if (!answerId) {
        jsonRow.grades.push(0);
      } else {
        let scores = grades.map((r) => r.points);
        let avgScore = Math.ceil(scores.reduce((a, b) => a + b, 0) / scores.length);
        psetScore += avgScore;
        psetCount += 1;
        jsonRow.grades.push(avgScore);
      }
    }
    jsonRow.grades.push(psetScore);
    jsonRow.grades.push(psetCount);
    let average = psetCount > 0 ? Math.round((psetScore / psetCount) * 10) / 10 : -1;
    jsonRow.grades.push(average);
    jsonGrades.push(jsonRow);
    if (psetCount > 0) {
    }
  }
  res.json(jsonGrades);
});

app.get("/gradeProblemSet/:psetId", async (req, res, next) => {
  const psetId = req.params.psetId;
  res.locals.psetId = psetId;
  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  res.locals.problems = await Problem.find({psetId: psetId});
  res.locals.answers = await Answer.find({psetId: psetId});
  res.locals.courseInfo = await Course.findOne({_id: res.locals.problemSet.courseId}, "ownerId");
  //console.log("looking up students")
  const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id});
  res.locals.students = memberList.map((x) => x.studentId);
  //console.log(res.locals.students)
  //console.log("getting student info")
  res.locals.studentsInfo = await User.find({_id: {$in: res.locals.students}}, {}, {sort: {googleemail: 1}});
  //console.log(res.locals.studentsInfo)
  const taList = await User.find({taFor: res.locals.courseInfo._id});
  const taIds = taList.map((x) => x._id);
  //console.log('taIds='+JSON.stringify(taIds))
  const taReviews = await Review.find({psetId: psetId, reviewerId: {$in: taIds}});
  //console.log("found "+taReviews.length+" reviews by "+taList.length+" tas")

  res.locals.taReviews = taReviews;
  //console.log(JSON.stringify(req.user._id))
  //console.log(JSON.stringify(taIds))
  if (taIds.filter((x) => x.equals(req.user._id)).length > 0) {
    res.locals.routeName = " gradeProblemSet";
    res.render("gradeProblemSet");
  } else {
    res.send("You are not allowed to grade problem sets.");
  }
});

app.get("/gradeProblemSetJSON/:psetId", async (req, res, next) => {
  const psetId = req.params.psetId;
  res.locals.psetId = psetId;
  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  res.locals.problems = await Problem.find({psetId: psetId});
  res.locals.answers = await Answer.find({psetId: psetId});
  res.locals.courseInfo = await Course.findOne({_id: res.locals.problemSet.courseId}, "ownerId");
  //console.log("looking up students")
  const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id});
  res.locals.students = memberList.map((x) => x.studentId);
  //console.log(res.locals.students)
  //console.log("getting student info")
  res.locals.studentsInfo = await User.find({_id: {$in: res.locals.students}}, {}, {sort: {googleemail: 1}});
  //console.log(res.locals.studentsInfo)
  const taList = await User.find({taFor: res.locals.courseInfo._id});
  const taIds = taList.map((x) => x._id);
  //console.log('taIds='+JSON.stringify(taIds))
  const taReviews = await Review.find({psetId: psetId, reviewerId: {$in: taIds}});
  //console.log("found "+taReviews.length+" reviews by "+taList.length+" tas")

  res.locals.taReviews = taReviews;
  //console.log(JSON.stringify(req.user._id))
  //console.log(JSON.stringify(taIds))
  if (taIds.filter((x) => x.equals(req.user._id)).length > 0) {
    res.locals.routeName = " gradeProblemSetJSON";
    res.render("gradeProblemSetJSON");
  } else {
    res.send("You are not allowed to grade problem sets.");
  }
});

app.get("/addProblem/:psetId", async (req, res, next) => {
  try {
    const pset = await ProblemSet.findOne({_id: req.params.psetId});
    res.locals.psetId = req.params.psetId;
    res.locals.skills = await Skill.find({courseId: pset.courseId});
    res.locals.routeName = " addProblem";
    res.render("addProblem");
  } catch (e) {
    next(e);
  }
});

app.post("/saveProblem/:psetId", async (req, res, next) => {
  try {
    const psetId = req.params.psetId;
    res.locals.psetId = psetId;
    res.locals.problemSet = await ProblemSet.findOne({_id: psetId});

    let skills = req.body.skills;
    console.log("skills=" + JSON.stringify(skills));
    console.log("typeof(skills=" + typeof skills);
    if (typeof skills == "undefined") {
      skills = [];
    } else if (typeof skills == "string") {
      skills = [skills];
    }

    let newProblem = new Problem({
      courseId: res.locals.problemSet.courseId,
      psetId: res.locals.problemSet._id,
      description: req.body.description,
      problemText: req.body.problemText,
      points: req.body.points,
      rubric: req.body.rubric,
      skills: skills,
      pendingReviews: [],
      allowAnswers: true,
      visible: req.body.visible == "visible",
      reviewable: req.body.reviewable == "reviewable",
      answerable: req.body.answerable == "answerable",
      peeReviewable: req.body.peerReviewable == "peerReviewable",
      createdAt: new Date(),
    });

    await newProblem.save().then((p) => {
      res.locals.problem = p;
    });

    res.locals.problems = await Problem.find({psetId: psetId});
    res.locals.courseInfo = await Course.findOne({_id: res.locals.problemSet.courseId}, "ownerId");
    //res.render("showProblemSet")
    res.redirect("/showProblemSet/" + psetId);
  } catch (e) {
    next(e);
  }
});

app.post("/updateProblem/:probId", async (req, res, next) => {
  try {
    const problem = await Problem.findOne({_id: req.params.probId});

    problem.description = req.body.description;
    problem.problemText = req.body.problemText;
    problem.points = req.body.points;
    problem.rubric = req.body.rubric;
    problem.createdAt = new Date();

    problem.visible = req.body.visible == "visible";
    problem.answerable = req.body.answerable == "answerable";
    problem.submitable = req.body.submitable == "submitable";
    problem.peerReviewable = req.body.peerReviewable == "peerReviewable";

    console.log("in updateProblem", problem.visible, req.body.visible, problem.submitable, req.body.submitable, problem.answerable, req.body.answerable, problem.peerReviewable, req.body.peerReviewable);

    let skills = req.body.skill;
    console.log("skills=" + JSON.stringify(skills));
    console.log("typeof(skills=" + typeof skills);
    if (typeof skills == "undefined") {
      skills = [];
    } else if (typeof skills == "string") {
      skills = [skills];
    }
    problem.skills = skills;

    await problem.save();

    res.redirect("/showProblem/" + req.params.probId);
  } catch (e) {
    next(e);
  }
});

app.get("/showProblem/:probId", async (req, res, next) => {
  try {
    const probId = req.params.probId;
    res.locals.probId = probId;
    res.locals.problem = await Problem.findOne({_id: probId});
    res.locals.course = await Course.findOne({_id: res.locals.problem.courseId}, "ownerId");
    res.locals.answerCount = await Answer.countDocuments({problemId: probId});
    const reviews = await Review.find({problemId: probId});
    res.locals.reviewCount = reviews.length;
    res.locals.averageReview = reviews.reduce((t, x) => t + x.points, 0) / reviews.length;
    res.locals.answers = await Answer.find({problemId: probId, studentId: res.locals.user._id});

    res.locals.skills = await Skill.find({_id: {$in: res.locals.problem.skills}});
    res.locals.skillsMastered = await getStudentSkills(res.locals.user._id);
    res.locals.routeName = " showProblem";
    res.render("showProblem");
  } catch (e) {
    console.log("Error in showProblem: " + e);
    next(e);
  }
});

app.get("/startProblem/:probId", async (req, res, next) => {
  const result = await Problem.updateOne({_id: req.params.probId}, {allowAnswers: true});
  res.redirect("/showProblem/" + req.params.probId);
});

app.get("/stopProblem/:probId", async (req, res, next) => {
  const result = await Problem.updateOne({_id: req.params.probId}, {allowAnswers: false});
  res.redirect("/showProblem/" + req.params.probId);
});

app.get("/updateSchema", async (req, res, next) => {
  const result = await Problem.updateMany({}, {allowAnswers: true});
  //console.dir(result)
  res.redirect("/");
});

function getElementBy_id(id, vals) {
  for (let i = 0; i < vals.length; i++) {
    if (vals[i]["_id"] + "" == id) {
      return vals[i];
    }
  }
  return null;
}

app.get("/showAllAnswers/:probId", async (req, res, next) => {
  try {
    const id = req.params.probId;
    res.locals.problem = await Problem.findOne({_id: id});
    const course = await Course.findOne({_id: res.locals.problem.courseId});
    const userReviews = await Review.find({problemId: id, reviewerId: req.user._id});
    res.locals.allSkills = await Skill.find({courseId: res.locals.problem.courseId});
    res.locals.getSkill = (id, vals) => getElementBy_id(id, vals);
    res.locals.numReviews = userReviews.length;
    res.locals.canView = res.locals.numReviews >= 2 || req.user._id.equals(course.ownerId);
    if (!res.locals.canView) {
      res.locals.answers = [];
      res.locals.reviews = [];
    } else {
      res.locals.answers = await Answer.find({problemId: id}).collation({locale: "en", strength: 2}).sort({answer: 1});
      res.locals.reviews = await Review.find({problemId: id});
    }
    res.locals.isTA = req.user.taFor && req.user.taFor.includes(course._id);
    const taList = await User.find({taFor: res.locals.problem.courseId});
    res.locals.taList = taList.map((x) => x._id);
    res.locals.routeName = " showAllAnswers";
    res.render("showAllAnswers");
  } catch (e) {
    next(e);
  }
});

app.get("/editProblem/:probId", async (req, res, next) => {
  const id = req.params.probId;
  res.locals.probId = id;
  res.locals.problem = await Problem.findOne({_id: id});
  res.locals.course = await Course.findOne({_id: res.locals.problem.courseId}, "ownerId");
  res.locals.skills = await Skill.find({_id: {$in: res.locals.problem.skills}});
  res.locals.allSkills = await Skill.find({courseId: res.locals.problem.courseId});
  res.locals.routeName = " editProblem";
  res.render("editProblem");
});

/*
  This route has some nuanced behavior.
  If the user tries to save an answer that has already
  been reviewed, then we should not let them do it and
  we should send them to a page that says their answer has
  been reviewed and they can't update it. 
*/
app.post("/saveAnswer/:probId", async (req, res, next) => {
  const id = req.params.probId;
  res.locals.problem = await Problem.findOne({_id: id});
  const problem = res.locals.problem;

  const answers = await Answer.find({studentId: req.user._id, problemId: problem._id});

  const answerIds = answers.map((x) => x._id);
  const reviews = await Review.find({answerId: {$in: answerIds}});
  console.log("about to try to save the new answer");
  console.dir(reviews);
  if (reviews.length > 0) {
    res.redirect("/showReviewsOfAnswer/" + answerIds[0]);
  } else {
    let newAnswer = new Answer({
      studentId: req.user._id,
      courseId: problem.courseId,
      psetId: problem.psetId,
      problemId: problem._id,
      answer: req.body.answer,
      reviewers: [],
      numReviews: 0,
      pendingReviewers: [],
      createdAt: new Date(),
    });

    await Answer.deleteMany({studentId: req.user._id, problemId: problem._id});

    await newAnswer.save();

    res.redirect("/showProblem/" + id);
  }
});

app.get("/gradeProblem/:probId/:studentId", async (req, res, next) => {
  try {
    const probId = req.params.probId;
    const studentId = req.params.studentId;

    let problem = await Problem.findOne({_id: probId});
    res.locals.student = await User.findOne({_id: studentId});

    let answer = await Answer.findOne({problemId: probId, studentId: studentId});

    //console.log("answer= "+JSON.stringify(answer))
    // and we need to add it to the problem.pendingReviews
    res.locals.answer = answer;
    res.locals.problem = problem;

    let myReviews = [];
    if (answer != undefined) {
      myReviews = await Review.find({problemId: problem._id, answerId: answer._id, reviewerId: req.user._id});
    }
    res.locals.numReviewsByMe = myReviews.length;
    res.locals.alreadyReviewed = myReviews.length > 0;

    //console.log('\n\n\nmy reviews='+JSON.stringify(myReviews))
    //console.log(res.locals.numReviewsByMe)
    if (true || res.locals.alreadyReviewed) {
      res.redirect("/showReviewsOfAnswer/" + answer._id);
    } else {
      res.locals.routeName = " reviewAnswer";
      res.render("reviewAnswer");
    }
  } catch (e) {
    next(e);
  }
});

app.get("/reviewAnswers/:probId", async (req, res, next) => {
  try {
    const probId = req.params.probId;
    let problem = await Problem.findOne({_id: probId});

    //first we remove all pendingReviews that have exceeded
    // the time limit of 60 secs = 60,000 ms
    // 60 is a magic number and should be moved up somewhere...
    const tooOld = new Date().getTime() - 60 * 1000;
    let expiredReviews = [];
    let pendingReviews = problem.pendingReviews.filter((x) => {
      if (x.timeSent < tooOld) {
        expiredReviews.push(x);
        //console.log("\nremoved an expired review ")
        //console.dir(x)

        return false;
      } else {
        return true;
      }
    });
    problem.pendingReviews = pendingReviews;
    problem.markModified("pendingReviews");
    await problem.save();

    expiredReviews.forEach(async function (x) {
      // remove the reviewerId from the list of pendingReviewers
      // and decrement the optimistic numReview field
      // pendingReviews has form x = {answerId,reviewerId,timeSent}
      let tempAnswer = await Answer.findOne({_id: x.answerId});
      tempAnswer.pendingReviewers = tempAnswer.pendingReviewers.filter((r) => {
        if (r.equals(x.reviewerId)) {
          tempAnswer.numReviews -= 1;
          //console.log("\nremoved reviewer '+r+' from pending reviews: ")
          //console.dir(x)
          return false;
        } else {
          //console.log('not removing '+r+' from pending reviewers')
          return true;
        }
      });
      tempAnswer.markModified("pendingReviewers");
      await tempAnswer.save();
    });

    // next, we find all answers to this Problem, sorted by numReviews
    let answers = await Answer.find({problemId: probId}).sort({numReviews: "asc"});

    // find first answer not already reviewed or being reviewed by user
    let i = 0;
    let answer = null;
    while (i < answers.length) {
      answer = answers[i];
      //console.log(`user=${req.user._id}`)
      //console.log(`answers[${i}] = ${JSON.stringify(answer)}`)
      if (!answer.reviewers.find((x) => x.equals(req.user._id)) && !answer.pendingReviewers.find((x) => x.equals(req.user._id))) {
        // we found an answer the user hasn't reviewed!
        answer.numReviews += 1; // we optimistically add 1 to numReviews
        answer.pendingReviewers.push(req.user._id);
        answer.markModified("pendingReviewers");
        await answer.save();

        // {answerId,reviewerId,timeSent}
        problem.pendingReviews.push({answerId: answer._id, reviewerId: req.user._id, timeSent: new Date().getTime()});

        problem.markModified("pendingReviews");

        await problem.save();
        break;
      } else {
        //console.log("reviewed this one!")
        answer = null;
      }
      i++;
    }

    // and we need to add it to the problem.pendingReviews
    res.locals.answer = answer;
    res.locals.student = {googlename: "", googleemail: ""};
    res.locals.problem = problem;
    res.locals.alreadyReviewed = false;
    res.locals.numReviewsByMe = await Review.find({problemId: problem._id, reviewerId: req.user._id}).length;

    //res.render("reviewAnswer")

    // get the skills for this problem

    if (answer) {
      res.redirect("/showReviewsOfAnswer/" + answer._id);
    } else {
      res.locals.routeName = " reviewAnswer";
      res.render("reviewAnswer");
    }
  } catch (e) {
    next(e);
  }
});

/*  saveReview
    when we save a review we need to create a new review document
    but also update the corresponding answer and problem documents
    to store the new information about number of reviews and pending reviews
    This is used when we generate an answer for a user to review
  */
app.post(
  "/saveReview/:probId/:answerId",

  async (req, res, next) => {
    try {
      console.log("in saveReview");
      console.dir(req.body);

      const problem = await Problem.findOne({_id: req.params.probId});

      const answer = await Answer.findOne({_id: req.params.answerId});

      const newReview = new Review({
        reviewerId: req.user._id,
        courseId: problem.courseId,
        psetId: problem.psetId,
        problemId: problem._id,
        answerId: req.params.answerId,
        studentId: answer.studentId,
        review: req.body.review,
        points: req.body.points,
        upvoters: [],
        downvoters: [],
        createdAt: new Date(),
      });

      await newReview.save();

      // next we update the reviewers info in the answer object
      answer.reviewers.push(req.user._id);
      answer.numReviews += 1;

      let pendingReviewers = [];

      for (let i = 0; i < answer.pendingReviewers.length; i++) {
        const reviewer = answer.pendingReviewers[i];

        if (reviewer.equals(req.user._id)) {
          answer.numReviews -= 1;

          // because we incremented it when we sent the review to user
        } else {
          pendingReviewers.push(reviewer);
        }
      }
      answer.pendingReviewers = pendingReviewers;
      answer.markModified("pendingReviewers");

      await answer.save();

      // finally we update the pendingReviews field of the problem
      // to remove this reviewer on this answer, if necessary
      // the reviewInfo might have been removed earlier if they
      // timed out before completing their review...
      let pendingReviews = [];
      for (let i = 0; i < problem.pendingReviews.length; i++) {
        reviewInfo = problem.pendingReviews[i];

        if (reviewInfo.answerId.equals(answer._id) && reviewInfo.reviewerId.equals(req.user._id)) {
          // don't push answer just reviewed by this user back into pendingReviews
        } else {
          pendingReviews.push(reviewInfo);
        }
      }

      problem.pendingReviews = pendingReviews;

      problem.markModified("pendingReviews");

      await problem.save();

      res.redirect("/showReviewsOfAnswer/" + answer._id);
      // we can now redirect them to review more answers
      // res.redirect('/reviewAnswers/'+req.params.probId)
    } catch (e) {
      next(e);
    }
  }
);

/*  saveReview
  when we save a review we need to create a new review document
  but also update the corresponding answer and problem documents
  to store the new information about number of reviews and pending reviews
  This is used when we generate an answer for a user to review
*/
app.post(
  "/saveReview2/:probId/:answerId",

  async (req, res, next) => {
    try {
      console.log("in saveReview2");
      console.dir(req.body);
      console.dir(req.headers);
      console.dir(req.method);

      const problem = await Problem.findOne({_id: req.params.probId});

      const answer = await Answer.findOne({_id: req.params.answerId});

      let skills = req.body.skill;
      console.log("skills=" + JSON.stringify(skills));
      console.log("typeof(skills=" + typeof skills);
      if (typeof skills == "undefined") {
        skills = [];
      } else if (typeof skills == "string") {
        skills = [skills];
      }

      const newReview = new Review({
        reviewerId: req.user._id,
        courseId: problem.courseId,
        psetId: problem.psetId,
        problemId: problem._id,
        answerId: req.params.answerId,
        studentId: answer.studentId,
        review: req.body.review,
        points: req.body.points,
        skills: skills,
        upvoters: [],
        downvoters: [],
        createdAt: new Date(),
      });

      const newReviewDoc = await newReview.save();

      // if the user is a TA, then make their review
      // the official review
      if (req.user.taFor.includes(problem.courseId)) {
        answer.officialReviewId = newReviewDoc._id;
        answer.review = req.body.review;
        answer.points = req.body.points;
        answer.skills = skills;
      }

      // next we update the reviewers info in the answer object
      answer.reviewers.push(req.user._id);
      answer.numReviews += 1;

      let pendingReviewers = [];

      for (let i = 0; i < answer.pendingReviewers.length; i++) {
        const reviewer = answer.pendingReviewers[i];

        if (reviewer.equals(req.user._id)) {
          answer.numReviews -= 1;

          // because we incremented it when we sent the review to user
        } else {
          pendingReviewers.push(reviewer);
        }
      }
      answer.pendingReviewers = pendingReviewers;
      answer.markModified("pendingReviewers");

      await answer.save();

      // finally we update the pendingReviews field of the problem
      // to remove this reviewer on this answer, if necessary
      // the reviewInfo might have been removed earlier if they
      // timed out before completing their review...
      let pendingReviews = [];
      for (let i = 0; i < problem.pendingReviews.length; i++) {
        reviewInfo = problem.pendingReviews[i];

        if (reviewInfo.answerId.equals(answer._id) && reviewInfo.reviewerId.equals(req.user._id)) {
          // don't push answer just reviewed by this user back into pendingReviews
        } else {
          pendingReviews.push(reviewInfo);
        }
      }

      problem.pendingReviews = pendingReviews;

      problem.markModified("pendingReviews");

      await problem.save();

      //res.redirect('/showReviewsOfAnswer/'+answer._id)
      if (req.body.destination == "submit and view this again") {
        res.redirect("/showReviewsOfAnswer/" + req.params.answerId);
      } else {
        res.redirect("/reviewAnswers/" + problem._id);
      }

      // we can now redirect them to review more answers
      // res.redirect('/reviewAnswers/'+req.params.probId)
    } catch (e) {
      next(e);
    }
  }
);

app.post("/removeReviews", async (req, res, next) => {
  try {
    /*
      We need to remove delete the Review, but also
      to remove the reviewerId from the list of reviewers
      for the answer...
      */
    let deletes = req.body.deletes;
    //console.log(`deletes=${deletes}`)
    //console.log(`type(deletes)=${typeof(deletes)}`)
    let reviews = null;

    if (!deletes) {
      res.send("nothing to delete");
      return;
    } else if (typeof deletes == "string") {
      let review = await Review.findOne({_id: deletes});
      reviews = [review];
    } else {
      reviews = await Review.find({_id: {$in: deletes}});
    }
    //console.log("reviews="+JSON.stringify(reviews))
    let answerId = reviews[0].answerId;
    let reviewerIds = reviews.map((r) => r.reviewerId);
    let answer = await Answer.findOne({_id: answerId});

    //console.log(`answer= ${JSON.stringify(answer)}`)
    //console.log(`answer.reviewers=${JSON.stringify(answer.reviewers)}`)
    //console.log(`reviewerIds= ${JSON.stringify(reviewerIds)}`)
    //console.log(answer.reviewers.indexOf(reviewerIds[0]))
    const newReviewerIds = removeElements(answer.reviewers, reviewerIds);
    //console.log('nri = '+JSON.stringify(newReviewerIds))
    answer.reviewers = newReviewerIds;
    await answer.save();
    await Review.deleteMany({_id: {$in: deletes}});
    //res.send("just updating answer ...")
    res.redirect("/showReviewsOfAnswer/" + answerId);
  } catch (e) {
    next(e);
  }
});

function removeElements(slist, rems) {
  for (let i = 0; i < rems.length; i++) {
    slist = slist.filter((s) => {
      const z = !s.equals(rems[i]);
      //console.log(`${s} ${rems[i]} ${z}`)
      return z;
    });
    //console.log(`${i}  ${JSON.stringify(slist)}`)
  }
  return slist;
}

app.get("/showReviewsOfAnswer/:answerId", async (req, res, next) => {
  try {
    const id = req.params.answerId;
    res.locals.answer = await Answer.findOne({_id: id});
    res.locals.problem = await Problem.findOne({_id: res.locals.answer.problemId});
    res.locals.student = await User.findOne({_id: res.locals.answer.studentId});
    res.locals.reviews = await Review.find({answerId: id}).sort({points: "asc", review: "asc"});
    const taList = await User.find({taFor: res.locals.problem.courseId});
    res.locals.taList = taList.map((x) => x._id);

    for (rev of res.locals.reviews) {
      rev.fullskills = await Skill.find({_id: {$in: rev.skills}});
      for (x of rev.fullskills) {
        console.log(x["name"]);
      }
    }

    res.locals.skills = await Skill.find({_id: {$in: res.locals.problem.skills}});
    res.locals.allSkills = await Skill.find({courseId: res.locals.answer.courseId});
    res.locals.regradeRequests = await RegradeRequest.find({answerId: id});

    res.locals.routeName = " showReviewsOfAnswer";
    res.render("showReviewsOfAnswer");
  } catch (e) {
    next(e);
  }
});

app.post("/requestRegrade/:reviewId", async (req, res, next) => {
  try {
    const reviewId = req.params.reviewId;
    const review = await Review.findOne({_id: reviewId});
    const regradeRequest = new RegradeRequest({
      reviewId: reviewId,
      answerId: review.answerId,
      problemId: review.problemId,
      psetId: review.psetId,
      courseId: review.courseId,
      studentId: review.studentId,
      reason: req.body.reason,
      reply: "none yet",
      completed: false,
      createdAt: new Date(),
    });
    await regradeRequest.save();
    console.log("The Review is:");
    console.dir(review);
    console.log("ci" + review.courseId);
    res.redirect("/showRegradeRequests/" + review.courseId);
  } catch (e) {
    next(e);
  }
});

app.get("/showRegradeRequests/:courseId", async (req, res, next) => {
  try {
    const regradeRequests = await RegradeRequest.find({courseId: req.params.courseId});
    res.locals.regradeRequests = regradeRequests;
    res.locals.courseId = req.params.courseId;
    res.locals.routeName = " showRegradeRequests";
    res.render("showRegradeRequests");
    //res.json([req.params.courseId,regradeRequests])
  } catch (e) {
    next(e);
  }
});

app.get("/showRegradeRequest/:requestId", async (req, res, next) => {
  try {
    const regradeRequest = await RegradeRequest.findOne({_id: req.params.requestId});
    res.locals.regradeRequest = regradeRequest;
    res.redirect("/showReviewsOfAnswer/" + regradeRequest.answerId);
    //res.json([req.params.requestId,regradeRequest])
  } catch (e) {
    next(e);
  }
});

app.post("/updateRegradeRequest/:regradeRequestId", async (req, res, next) => {
  try {
    let regradeRequest = await RegradeRequest.findOne({_id: req.params.regradeRequestId});
    regradeRequest.reply = req.body.reply;
    regradeRequest.completed = true;
    await regradeRequest.save();
    res.redirect("/showReviewsOfAnswer/" + regradeRequest.answerId);
    //res.json([req.params.regradeRequestId,regradeRequest])
  } catch (e) {
    next(e);
  }
});

app.post("/giveGoodGrade/:probId/:answerId", async (req, res, next) => {
  let answerId = req.params.answerId;
  let userId = req.params.userId;
  let review = req.body.review;
  let points = req.body.points;
  console.log("in giveGoodGrade");
  console.log(review + " " + points);
  console.log("req.body=");
  console.dir(req.body);

  const problem = await Problem.findOne({_id: req.params.probId});

  const answer = await Answer.findOne({_id: req.params.answerId});

  const newReview = new Review({
    reviewerId: req.user._id,
    courseId: problem.courseId,
    psetId: problem.psetId,
    problemId: problem._id,
    answerId: req.params.answerId,
    studentId: answer.studentId,
    review: req.body.review,
    points: req.body.points,
    upvoters: [],
    downvoters: [],
    createdAt: new Date(),
  });

  await newReview.save();

  answer.reviewers.push(req.user._id);
  answer.numReviews += 1;

  answer.save();

  res.send("testing giveGoodGrade");
});

app.get("/thumbsU/:mode/:reviewId/:userId", async (req, res, next) => {
  let reviewId = req.params.reviewId;
  let userId = req.params.userId;
  let mode = req.params.mode;
  if (mode == "select") {
    await Review.findOneAndUpdate({_id: reviewId}, {$push: {upvoters: userId}});
  } else {
    await Review.findOneAndUpdate({_id: reviewId}, {$pull: {upvoters: userId}});
  }

  res.json({result: "OK"});
});

app.get("/thumbsD/:mode/:reviewId/:userId", async (req, res, next) => {
  let reviewId = req.params.reviewId;
  let userId = req.params.userId;
  let mode = req.params.mode;
  if (mode == "select") {
    await Review.findOneAndUpdate({_id: reviewId}, {$push: {downvoters: userId}});
  } else {
    await Review.findOneAndUpdate({_id: reviewId}, {$pull: {downvoters: userId}});
  }

  res.json({result: "OK"});
});

app.get("/showReviewsByUser/:probId", async (req, res, next) => {
  const id = req.params.probId;
  res.locals.problem = await Problem.findOne({_id: id});
  res.locals.usersReviews = await Review.find({reviewerId: req.user._id, problemId: res.locals.problem._id});
  res.locals.allReviews = await Review.find({problemId: res.locals.problem._id});
  const answerIds = res.locals.usersReviews.map((r) => r.answerId);
  res.locals.usersReviewedAnswers = await Answer.find({_id: {$in: answerIds}});
  res.locals.routeName = " showReviewsByUser";
  res.render("showReviewsByUser");
});

app.get("/showReview/:reviewId", (req, res) => res.send("Under Construction"));

app.get("/showAllStudentInfo/:courseId", (req, res) => {
  res.redirect("/showTheStudentInfo/all/" + req.params.courseId);
});

app.get("/showStudentInfo/:courseId", (req, res) => {
  res.redirect("/showTheStudentInfo/summary/" + req.params.courseId);
});

app.get("/showTheStudentInfo/:option/:courseId", async (req, res, next) => {
  try {
    const id = req.params.courseId;
    // get the courseInfo
    res.locals.courseInfo = await Course.findOne({_id: id}, "name ownerId");

    const isTA = req.user.taFor && req.user.taFor.includes(res.locals.courseInfo._id);
    const isOwner = req.user._id.equals(res.locals.courseInfo.ownerId);

    if (!(isOwner || isTA)) {
      //console.log('isOwner = '+isOwner)
      //console.log('isTA = '+isTA)
      res.send("only the course owner and TAs can see this page");
      return;
    }

    // get the list of ids of students in the course
    const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id});
    res.locals.students = memberList.map((x) => x.studentId);

    // student status is a map from id to status
    // we can use this to filter student based on their statue
    // e.g. enrolled, dropped, ta, guest, owner, ...
    // we will need a page to see all students and edit their statuses
    res.locals.studentStatus = new Map();
    memberList.map((x) => {
      res.locals.studentStatus.set(x.studentId, x.status);
    });

    res.locals.studentsInfo = await User.find({_id: {$in: res.locals.students}});

    const courseId = res.locals.courseInfo._id;
    res.locals.answers = await Answer.find({courseId: courseId});

    res.locals.problems = await Problem.find({courseId: courseId});

    res.locals.reviews = await Review.find({courseId: courseId});

    const gradeSheet = createGradeSheet(res.locals.studentsInfo, res.locals.problems, res.locals.answers, res.locals.reviews);

    res.locals.gradeSheet = gradeSheet;
    /*
        await Course.findOneAndUpdate(
                {_id:courseId},
                {$set:{gradeSheet:{},gradesUpdateTime:new Date()}},
                {new:true})
*/

    res.locals.routeName = " showTheStudentInfo";

    if (req.params.option == "all") {
      res.render("showAllStudentInfo");
    } else if (req.params.option == "csv") {
      res.render("showStudentInfoCSV");
    } else {
      res.render("showStudentInfo");
    }
  } catch (e) {
    next(e);
  }
});

app.get("/showOneStudentInfo/:courseId/:studentId", async (req, res, next) => {
  try {
    res.locals.courseInfo = await Course.findOne({_id: req.params.courseId}, "name ownerId");
    res.locals.studentInfo = await User.findOne({_id: req.params.studentId});

    const isTA = req.user.taFor && req.user.taFor.includes(res.locals.courseInfo._id);
    const isOwner = req.user._id.equals(res.locals.courseInfo.ownerId);

    if (!isOwner && !isTA && !req.user._id.equals(req.params.studentId)) {
      res.send("only the course owner and TAs and the student themselves can see this page");
      return;
    }

    // get the list of ids of students in the course
    const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id});
    res.locals.students = memberList.map((x) => x.studentId);

    res.locals.studentsInfo = await User.find({_id: {$in: res.locals.students}});

    const courseId = res.locals.courseInfo._id;
    res.locals.answers = 
       await Answer.find({courseId: courseId})
             .populate('skills');

    res.locals.problems = 
       await Problem.find({courseId: courseId})
            .populate('skills');

    res.locals.reviews = await Review.find({courseId: courseId});

    const gradeSheet = createGradeSheet(res.locals.studentsInfo, res.locals.problems, res.locals.answers, res.locals.reviews);

    res.locals.gradeSheet = gradeSheet;
    res.locals.routeName = " showOneStudentInfo";

    res.render("showOneStudentInfo");
  } catch (e) {
    next(e);
  }
});

app.post("/addTA/:courseId", async (req, res, next) => {
  try {
    //console.log("in addTA handler "+req.body.email)
    let ta = await User.findOne({googleemail: req.body.email});
    if (ta) {
      ta.taFor = ta.taFor || [];
      ta.taFor.push(req.params.courseId);
      ta.markModified("taFor");
      //console.log("updating ta "+ta._id)
      //console.dir(ta)
      await ta.save();
    }
    res.redirect("/showTAs/" + req.params.courseId);
  } catch (e) {
    next(e);
  }
});

app.post("/removeTAs/:courseId", async (req, res, next) => {
  try {
    //console.log("in removeTAs handler ")
    //console.dir(req.body)
    //console.log(typeof req.body.ta)
    if (req.body.ta == null) {
      //console.log("nothing to delete")
    } else if (typeof req.body.ta == "string") {
      //console.log("delete "+req.body.ta)
      await User.update({_id: req.body.ta}, {$set: {taFor: []}});
    } else {
      //console.log("delete several:")
      req.body.ta.forEach(async (x) => {
        //console.log('x='+x)
        await User.update({_id: x}, {$set: {taFor: []}});
      });
    }

    res.redirect("/showTAs/" + req.params.courseId);
  } catch (e) {
    next(e);
  }
});

app.get("/showTAs/:courseId", async (req, res, next) => {
  try {
    res.locals.courseInfo = await Course.findOne({_id: req.params.courseId}, "name ownerId coursePin");
    res.locals.tas = await User.find({taFor: req.params.courseId});
    //console.log("in showTAs handler")
    res.locals.routeName = " showTAs";

    res.render("showTAs");
  } catch (e) {
    next(e);
  }
});

// add the studentId to each Review ...
app.get("/updateReviews", async (req, res, next) => {
  if (req.user.googleemail != "tjhickey@brandeis.edu") {
    res.send("you are not allowed to do this!");
    //console.log("did we get here???  Yes we did!!")
    return;
  } else {
    res.send("we aren't doing this anymore!");
    //console.log("did we get here???  Yes we did!!")
    return;
    try {
      let counter = 0;
      const reviews = await Review.find({});
      reviews.forEach(async (r) => {
        // lookup the answer, get the studentId,
        // and add it to the review, and save it...
        answer = await Answer.findOne({_id: r.answerId});
        //console.log(counter+": "+r._id+" "+answer.studentId)
        counter += 1;
        r.studentId = answer.studentId;
        await r.save();
      });
    } catch (e) {
      console.log("caught an error: " + e);
      console.dir(e);
    }
    res.send("all done");
  }
});

// add the studentId to each Review ...
app.get("/updateReviews2", async (req, res, next) => {
  if (req.user.googleemail != "tjhickey@brandeis.edu") {
    res.send("you are not allowed to do this!");
  } else {
    try {
      // for each answer, find all of the reviews of that answer
      // create the reviewers field of the answer and set it
      let counter = 0;
      const answers = await Answer.find({});
      answers.forEach(async (a) => {
        try {
          //  answer, get the studentId,
          // and add it to the review, and save it...
          reviews = await Review.find({answerId: a._id});
          reviewers = reviews.map((r) => r.reviewerId);
          //console.log(a._id+" "+JSON.stringify(reviewers))
          a.reviewers = reviewers;
          await a.save();
        } catch (e) {
          console.log("caught an error updating an answer: " + e);
        }
      });
    } catch (e) {
      console.log("caught an error: " + e);
      console.dir(e);
    }
    res.send("all done");
  }
});

app.get("/removeGradeSheets", async (req, res, next) => {
  if (req.user.googleemail != "tjhickey@brandeis.edu") {
    res.send("you are not allowed to do this!");
  } else {
    try {
      let counter = 0;
      const courses = await Course.find({});
      courses.forEach(async (c) => {
        // lookup the answer, get the studentId,
        // and add it to the review, and save it...
        c.gradeSheet = {};
        //console.log('updated course :'+JSON.stringify(c))
        await c.save();
      });
    } catch (e) {
      console.log("caught an error: " + e);
      console.dir(e);
    }
    res.send("all done");
  }
});

app.get("/removeOrphanAnswers", async (req, res, next) => {
  try {
    if (req.user.googleemail != "tjhickey@brandeis.edu") {
      res.send("you are not allowed to do this!");
    } else {
      /* 
              Find all reviews whose answer has been deleted,
              and remove those reviews. 
              First we find all of the answers and create a list of the AnswerIds
              Then we find all reviews whose answer is not in that list.
              These are the orphans.
              Then we delete those orphan reviews.
          */
      console.log("in /removeOrphanAnswers");
      const answers = await Answer.find({});
      console.log("num answers is " + answers.length);
      const answerIds = answers.map((x) => x._id);
      console.log("num answerIds is " + answerIds.length);
      const orphans = await Review.find({answerId: {$not: {$in: answerIds}}});
      console.log("num orphans is " + orphans.length);
      const orphanIds = orphans.map((x) => x._id);
      const numrevsBefore = await Review.find().count();
      await Review.deleteMany({_id: {$in: orphanIds}});
      const numrevsAfter = await Review.find().count();
      res.send("before " + numrevsBefore + " after:" + numrevsAfter);
    }
  } catch (e) {
    next(e);
  }
});

app.get("/updateOfficialReviews", async (req, res, next) => {
  if (req.user.googleemail != "tjhickey@brandeis.edu") {
    res.send("you are not allowed to do this!");
  } else {
    try {
      // iterate through all answers
      // look for reviews a review by a TA
      // if found, then use it to update the answer

      let answers = await Answer.find();
      for (let answer of answers) {
        let reviews = await Review.find({answerId: answer._id});
        for (let review of reviews) {
          let reviewer = await User.findOne({_id: review.reviewerId});
          if (reviewer && reviewer.taFor && reviewer.taFor.includes(answer.courseId)) {
            answer.officialReviewId = review._id;
            answer.points = review.points;
            answer.review = review.review;
            answer.skills = review.skills;
            await answer.save();
          }
        }
      }
    } catch (e) {
      console.log("caught an error: " + e);
      console.dir(e);
      next(e);
    }
    res.send("all done");
  }
});

const ObjectId = mongoose.Types.ObjectId;

const masteryAgg = (courseId) => [
  {
    $match: {
      courseId: new ObjectId(courseId),
    },
  },
  {
    $group: {
      _id: "$studentId",
      numAns: {
        $sum: 1,
      },
      skills: {
        $addToSet: {
          $arrayElemAt: ["$skills", 0],
        },
      },
    },
  },
];

app.get("/mastery/:courseId", async (req, res, next) => {
  const agg = masteryAgg(req.params.courseId);
  console.dir(agg);
  const zz = await Answer.aggregate(agg);
  res.json(zz);
});

const masteryAgg2 = (courseId) => [
  {
    $match: {
      courseId: new ObjectId(courseId),
    },
  },
  {
    $group: {
      _id: "$studentId",
      numAns: {
        $sum: 1,
      },
      skills: {
        $push: "$skills",
      },
    },
  },
];

const skillCount = (skills, skillLists) => {
  skillmap = {};
  for (skill of skills) {
    skillmap[skill] = 0;
  }
  for (skillList of skillLists) {
    for (skill of skillList) {
      skillmap[skill] += 1;
    }
  }
  return skillmap;
};

/*
    This route will analyze the skill mastery for the entire class.
    The main goal is to generate a table which shows for each student
    and for each skill, the number of times that students has demonstrated
    mastery of that skill. We will put the skills in an array and label the
    skill columns with numbers (perhaps with tooltips to see the full name).
  */
app.get("/mastery2/:courseId", async (req, res, next) => {
  const courseId = req.params.courseId;
  const agg = masteryAgg2(courseId);
  console.dir(agg);
  const mastery = await Answer.aggregate(agg);
  const studentIds = mastery.map((x) => x._id);
  const students = await User.find({_id: {$in: studentIds}});
  const skills = await Skill.find({courseId});
  const skillIds = skills.map((x) => x._id);
  const studentSkillCounts = {};
  for (student of mastery) {
    studentSkillCounts[student["_id"]] = skillCount(skillIds, student["skills"]);
  }
  const studentmap = {};
  for (student of students) {
    studentmap[student.id] = student;
  }

  let skillmap = {}; // this maps the skill id to the skill
  for (skill of skills) {
    skillmap[skill.id] = skill;
  }
  let sum = (vals) => {
    total = 0;
    for (val of vals) {
      total += val;
    }
    return total;
  };

  let sum2 = (vals) => {
    total = 0;
    for (val of vals) {
      total += val > 0 ? 1 : 0;
    }
    return total;
  };

  let data = [];
  for (student in studentSkillCounts) {
    let a = {};
    a["student"] = studentmap[student];
    a["skillCounts"] = studentSkillCounts[student];
    a["total"] = sum2(Object.values(a["skillCounts"]));
    data.push(a);
  }
  data = data.sort((x, y) => (x["total"] < y["total"] ? 1 : -1));
  res.locals.routeName = " summarizeSkills";

  res.render("summarizeSkills", {courseId, data, mastery, studentIds, students, studentmap, studentSkillCounts, skillIds, skillmap, skills});

  //res.json({data,mastery,studentIds,students,studentSkillCounts,skillIds,skillmap,skills})
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.locals.routeName = " error";
  res.render("error");
});

function createGradeSheet(students, problems, answers, reviews) {
  let gradeSheet = {};
  let problemList = {};
  let answerList = {};
  for (let s in students) {
    let student = students[s];
    gradeSheet[student._id] = {student: student, answers: {}};
  }
  for (let p in problems) {
    let problem = problems[p];
    problemList[problem._id] = problem;
  }
  for (let a in answers) {
    let answer = answers[a];
    try {
      answerList[answer._id] = answer;
      if (answer == undefined) {
        console.log("answer undefined a=" + a);
      } else if (!("studentId" in answer)) {
        console.log("answer.studentId undefined. answer =");
        console.dir(answer);
      }
      // it is possible that a TA will not be a student
      // so we need to create a
      gradeSheet[answer.studentId] = gradeSheet[answer.studentId] || {status: "non-student", student: "non-student", answers: {}};
      gradeSheet[answer.studentId]["answers"][answer._id] = {answer: answer, reviews: []};
    } catch (error) {
      console.log("Error in createGradeSheet: " + error.message + " " + error);
      console.log(error);
    }
  }

  for (let r in reviews) {
    let review = reviews[r];
    try {
      // the problem is that review.answerId might correspond to an answer
      // that I deleted!  but there is another duplicate with the same
      // review.studentId and same review.problemId, so I may need to redesign.
      // I could create an updateReviews route that would update all
      // review.answerIds based on the studentId and problemId
      let z = gradeSheet[answerList[review.answerId].studentId]["answers"][review.answerId];
      //z['reviews'] = z['reviews']||[]
      z["reviews"].push(review);
    } catch (error) {
      console.log("Error in createGradeSheet-2s: " + error.message + " " + error);
      console.log("error.lineNumber = " + error.linenNumber);
      console.log("stack: " + error.stack);
    }
  }

  return {grades: gradeSheet, problems: problemList, answers: answerList};
}

module.exports = app;
