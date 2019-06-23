var express = require("express");
var logger = require("morgan");
var mongoose = require("mongoose");
var exphbs = require("express-handlebars");

// Axios is a promised-based http library, similar to jQuery's Ajax method
// It works on the client and on the server
axios = require("axios");
//Server-side jQuery implementation
var cheerio = require("cheerio");

// Require all models
var db = require("./models");

var PORT = process.env.PORT || 3000;


// Initialize Express
var app = express();

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Parse request body as JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Make public a static folder
app.use(express.static("public"));
// Handlebars
//app.engine("handlebars", exphbs({
  //defaultLayout: "main"
//}));
//app.set("view engine", "handlebars");

// Connect to the Mongo DB
//mongoose.connect("mongodb://localhost/mongoHeadlines", { useNewUrlParser: true });

var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";
mongoose.connect(MONGODB_URI, { useNewUrlParser: true });


// Routes

// A GET route for scraping the daily mash website
app.get("/scrape", function (req, res) {
  // First, we grab the body of the html with axios
  axios.get("https://www.thedailymash.co.uk/").then(function (response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data);
    var count = 0;

    // Now, we grab every h2 within an article tag, and do the following:
    $(".bump-view").each(function (i, element) {
      // Save an empty result object
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      result.title = $(this).text().trim();
            result.link = $(this).attr("href").trim();
            /*result.summary = $(this)
                .children("div")
                .next().next()
                .children("div")
                .children("p")
                .text();*/
                
                console.log(result)
      // Create a new Article using the `result` object built from scraping
      if(result.title && result.link) {
      db.Article
        .create(result)
        .then(function (dbArticle) {
          console.log(dbArticle);
        })
        .catch(function (err) {
          // If an error occurred, log it
          console.log(err);
        });
      }
    });

    // Send a message to the client
    res.send("Scrape Complete");
  });
});

// Route for getting all Articles from the db
app.get("/notes", function(req, res) {
  // Grab every document in the Articles collection
  db.Note
    .find({})
    .then(function(dbNote) {
      // If we were able to successfully find Articles, send them back to the client
      res.json(dbNote);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for getting all Articles from the db
app.get("/articles", function(req, res) {
  // Grab every document in the Articles collection
  db.Article
    .find({}).populate("note")
    .then(function(dbArticle) {
      // If we were able to successfully find Articles, send them back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// delete all articles
app.delete("/articles/deleteAll", function(req, res) {
  // Remove all the articles
  db.Article.remove( { } ).then(function(err) {
    res.json(err);
  })
  
    
});


// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article
    .findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("note")
    .then(function(dbArticle) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note
    .create(req.body)
    .then(function(dbNote) {
      // get the article and add any notes that don't already exist
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { $addToSet: { note: dbNote._id }}, { new: true });
    })
    .then(function(dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Delete a note
app.delete("/notes/deleteNote/:note_id/:article_id", function(req, res) {
  // Use the note id to find and delete it
  db.Note.findOneAndRemove({ _id: req.params.note_id }, function(err) {
    // if any errors occur...
    if (err) {
      console.log(err);
      res.send(err);
    }
    else { // go update the article now that we're missing a note
      db.Article.findOneAndUpdate({ _id: req.params.article_id }, {$pull: {note: req.params.note_id}})
        .exec(function(err, data) {
          // if any errors occur...
          if (err) {
            console.log(err);
            res.send(err);
          } else {
            res.send(data);
          }
        });
    }
  });
});


// Route for saving an article
app.post("/saved/:id", function(req, res) {  // grab it by the id and save it
    db.Article.findOneAndUpdate({_id: req.params.id}, {$set: {saved: true}})
        .then(function(dbArticle) {
            res.json(dbArticle);
        });
});

// Route for getting all saved articles
app.get("/saved", function(req, res) {
  // Grab every document in the saved collection and populate its notes
  db.Article.find({saved: true}).populate("note")
    .then(function(dbArticle) {
      // If we were able to successfully, send them back to the client
     // res.render("/saved");
     res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route to delete a saved article
app.post("/deleteSaved/:id", function(req, res) {
    // grab the article by its id 
   db.Article.findOneAndUpdate({_id: req.params.id}, {$set: {saved: false}})
        // return the notes left
        .then(function(dbArticle) {
            res.json(dbArticle);
        })
        .catch(function(err) {
            // If an error occurs, send it back to the client
            res.json(err);
        });
});


// Start the server
app.listen(PORT, function () {
  console.log("App running on port " + PORT + "!");
});