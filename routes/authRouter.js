/*
  auth.js handles all of the authentication routes
*/
const express = require("express");
const authRouter = express.Router();

// Authentication
var GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;
// here we set up authentication with passport
const passport = require("passport");
const configPassport = require("../config/passport");
configPassport(passport);

const User = require("../models/User");

// here are the authentication routes
authRouter.use(passport.initialize());
authRouter.use(passport.session());

// here is where we check on their logged in status
authRouter.use((req, res, next) => {
  res.locals.title = "Peer Review App";
  res.locals.loggedIn = false;
  if (req.isAuthenticated()) {
    res.locals.user = req.user;
    res.locals.loggedIn = true;
  } else {
    res.locals.user = {};
    res.locals.loggedIn = false;
  }
  next();
});

authRouter.get("/loginerror", function (req, res) {
  res.locals.routeName = " loginerror";
  res.render("loginerror", {});
});

authRouter.get("/login", function (req, res) {
  res.locals.routeName = " login";
  res.locals.allow_local_login = process.env.ALLOW_LOCAL_LOGIN;
  console.log("in /login: allow_local_login = " + res.locals.allow_local_login);
  res.render("login", {});
});

// route for logging out
authRouter.get("/logout", function (req, res) {
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
authRouter.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

authRouter.get(
  "/login/authorized",
  passport.authenticate("google", {
    successRedirect: "/lrec",
    failureRedirect: "/loginerror",
  }),
);

function localOnly(req, res, next) {
  if (process.env.NODE_ENV === "development") {
    next();
  } else {
    res.status(404).send("Not Found");
  }
}

authRouter.get("/login/local", localOnly, async (req, res, next) => {
  res.locals.routeName = " login";
  res.render("localLogin");
});

authRouter.post("/auth/local/register", localOnly, function (req, res, next) {
  console.log("registering user");
  User.register(
    new User({ googleemail: req.body.username, googlename: req.body.name }),
    req.body.password,
    function (err) {
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
    },
  );
});

authRouter.post(
  "/auth/local/login",
  localOnly,
  passport.authenticate("local", { failureRedirect: "/loginerror" }),
  function (req, res) {
    res.redirect("/lrec");
  },
);

module.exports = authRouter;
