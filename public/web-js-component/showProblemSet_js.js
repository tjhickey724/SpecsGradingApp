var [problems, courseInfo, myAnswers, psetReviews, skills] = data_loader();

problem_list(problems, skills);

problem_content(problems);


// *************************    function defination    *************************
function data_loader() {
  // get data
  var d = document.getElementById("passLocal").dataset.problems;
  console.log(d.length);
  var problems = JSON.parse(document.getElementById("passLocal").dataset.problems);
  
  var courseInfo = JSON.parse(document.getElementById("passLocal").dataset.courseinfo);
  var myAnswers = JSON.parse(document.getElementById("passLocal").dataset.myanswers);
  var psetReviews = JSON.parse(document.getElementById("passLocal").dataset.psetreviews);
  var skills = JSON.parse(document.getElementById("passLocal").dataset.skills);
  // console.log(psetReviews);

  return [problems, courseInfo, myAnswers, psetReviews, skills];
}

function problem_list(problems, skills) {
  var ul = document.getElementById("problem_list");
  ul.setAttribute("class", "nav nav-tabs");
  
  for (var i = 0; i < problems.length; i++) {
    // li start
    var li = document.createElement("li");
    if (i==0) {
      li.setAttribute("class", "active text-center");
    } else {
      li.setAttribute("class", "text-center");
    }
  
    // a start
    var a = document.createElement("a");
    a.setAttribute("href", "#Problem"+i.toString());
    a.setAttribute("data-toggle", "tab");
    
    // strong
    var strong = document.createElement("strong");

    var problem_title = problems[i].description || "no name"
    if (problem_title.length > 16) {
      problem_title = problem_title.substring(0, 16);
      problem_title += " ..."
    };
    strong.appendChild(document.createTextNode((i+1).toString()+". "+problem_title));

    const skillsToMaster=problems[i].skills.filter( (skill)=> !skills.includes(skill.toString())).length
    // div start
    var div = document.createElement("div");
    if (skillsToMaster == 0) {
      div.setAttribute("style", "margin-top:5px; border-radius: 4px; border: white; color:green; \
        padding:1px 10px; background-color:rgb(218, 255, 223); ");
      // small
      var small = document.createElement("small");
      small.appendChild(document.createTextNode("all skills mastered"));
    } else {
      div.setAttribute("style", "margin-top:5px; border-radius: 4px; border: white; color:red; \
        padding:1px 10px; background-color:rgb(255, 218, 218); ");
      // small
      var small = document.createElement("small");
      small.appendChild(document.createTextNode(skillsToMaster.toString() + "/" 
      + problems[i].skills.length.toString() + " " + "skills left to master"));
    }
    
    // div end
    div.appendChild(small);

    // a end
    a.appendChild(strong);
    a.appendChild(div);
    
    // li end
    li.appendChild(a);
    
    // ul end
    ul.appendChild(li);
  }
}

function problem_content(problems, courseInfo, myAnswers, psetReviews, skills) {
  
  // problem content start
  var problemContent = document.getElementById("problem_content");
  problemContent.setAttribute("class", "tab-content");
  problemContent.setAttribute("style", "background-color:rgb(255, 255, 255); margin-bottom:20px");
  for (var i = 0; i < problems.length; i++) {
    // problem start
    var prob = document.createElement("div");
    prob.setAttribute("id", "Problem"+i.toString());
    if (i==0) {
      prob.setAttribute("class", "tab-pane fade in active");
    } else {
      prob.setAttribute("class", "tab-pane fade");
    }
    prob.setAttribute("style", "margin-left:25px; margin-right:25px;")
    if (problems[i].answerable) {
      var question = question_from(problems[i]);
      var answer = answer_group(problems[i], courseInfo, myAnswers, psetReviews, skills);

      prob.appendChild(question);
      prob.appendChild(document.createElement("br"));
      prob.appendChild(answer);

      // Question content end
      problemContent.appendChild(prob);
    } else {
      var prob_h1 = document.createElement("h1");
      prob_h1.appendChild(document.createTextNode("You may not submit this time."));
      prob.appendChild(prob_h1);
    }
  }
    
}

function question_from(problem) {
  // ---- Quetion from ----
  var question = document.createElement("div");
  question.setAttribute("class", "form-group");
  question.setAttribute("style", "font-family:'Courier New';");
  // question label start
  question_label = document.createElement("label");
  question_label.setAttribute("for", "question");

  // quetion label
  var question_label_h3 = document.createElement("h3");
  question_label_h3.setAttribute("style", "font-weight: bold;");
  question_label_h3.appendChild(document.createTextNode(problem.description));
  
  // label label end
  question_label.appendChild(question_label_h3);

  // Quetion description
  var question_h4 = document.createElement("h4");
  question_h4.setAttribute("class", "form-question");
  question_h4.appendChild(document.createTextNode(problem.problemText));

  // question
  question.appendChild(question_label);
  question.appendChild(question_h4);

  return question;
}

function answer_group(problem, courseInfo, myAnswers, psetReviews, skills) {
  // ---- answer group ----
  // var studentAnswer=(myAnswers.length> 0? myAnswers[0]:{myAnswers:problem.problemTemplate||""});
  
  // answer-group start
  var answer = document.createElement("div");
  answer.setAttribute("class", "form-group");
  answer.setAttribute("style", "margin-top:20px; margin-bottom:20px");
  
  // answer form start
  var form_answer = document.createElement("form");
  form_answer.setAttribute("method", "post");
  form_answer.setAttribute("action", "/saveAnswer/"+problem._id);

  // Your answer
  var answer_label = document.createElement("label");
  answer_label.setAttribute("for", "answer");
  answer_label.setAttribute("style", "color:rgb(35, 35, 35); font-family:'Arial';  display: block; margin-top: \
    1.33em; margin-bottom: 1.33em; margin-left: 0; margin-right: 0; font-weight: bold;");
  answer_label.appendChild(document.createTextNode("Your answer"));

  // text area
  var text_area = document.createElement("textarea");
  text_area.setAttribute("class", "form-control form-control-lg");
  text_area.setAttribute("style", "font-family:'Courier New'; font-size:12pt");
  text_area.setAttribute("name", "answer");
  text_area.setAttribute("rows", 10);
  text_area.setAttribute("placeholder", "Enter your answer here");

  // button
  var form_button = document.createElement("input");
  form_button.setAttribute("class", "d-grid col-4 mx-auto");
  form_button.setAttribute("style", "font-family:'Arial'; font-size:12pt; margin-top:5px; margin-bottom:20px; \
    border-radius: 4px; border: white; color:white; background-color:rgb(66, 126, 255)");
  form_button.setAttribute("type", "submit");
  form_button.setAttribute("value", "Submit");

  // answer-from end
  form_answer.appendChild(answer_label);
  form_answer.appendChild(text_area);
  form_answer.appendChild(form_button);

  // answer-group end
  answer.appendChild(form_answer);
  answer.appendChild(document.createElement("br"));
  answer.appendChild(document.createElement("br"));
  var skill = skill_from(problem, courseInfo, myAnswers, psetReviews, skills);
  answer.appendChild(skill);

  return answer;
}

function skill_from(problem, courseInfo, myAnswers, psetReviews, skills) {
  // skill from start
  var skill = document.createElement("div");
  skill.setAttribute("class", "card");
  skill.setAttribute("style", "margin-bottom:margin-bottom:20px; border:white; border-radius: 4px; \
    background-color:rgb(218, 249, 255); margin-left:-25px; margin-right:-25px;");
  
  // body start
  var skill_body = document.createElement("div");
  skill_body.setAttribute("class", "card-body");
  skill_body.setAttribute("style", "margin-left:20px")

  // title
  var skill_body_h4 = document.createElement("h4");
  skill_body_h4.setAttribute("class", "card-title");
  skill_body_h4.setAttribute("style", "font-family:'Arial'; margin-top:20px; font-weight: bold;");
  skill_body_h4.appendChild(document.createTextNode("2 Skills: "));

  // content
  var skill_body_p = document.createElement("p");
  skill_body_p.setAttribute("class", "card-text");
  
  var skill_body_p_li = document.createElement("li");
  skill_body_p_li.setAttribute("style", "font-family:'Arial'; color:red; font-weight: bold;");
  skill_body_p_li.appendChild(document.createTextNode("Created"));
  var skill_body_p_li_span = document.createElement("span");
  skill_body_p_li_span.appendChild(document.createTextNode("  - skills mastered"))
  skill_body_p_li.appendChild(skill_body_p_li_span)

  skill_body_p.appendChild(skill_body_p_li);
  
  
  // body end
  skill_body.appendChild(skill_body_h4);
  skill_body.appendChild(skill_body_p);

  // skill from end
  skill.appendChild(skill_body);

  return skill;
}