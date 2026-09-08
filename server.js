require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

// Database Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/blogDB')
  .then(() => console.log('Connected to MongoDB Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// --- DATA SCHEMAS & MODELS ---
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: String, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', PostSchema);

// --- MIDDLEWARES ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'mySuperSecretKey123',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000, httpOnly: true }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 🔒 CRITICAL: Auth Guard Middleware (Must be defined before routes use it)
const requireLogin = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  next();
};

// --- AUTH ROUTES ---
app.get('/', (req, res) => res.redirect('/home'));

app.get('/register', (req, res) => res.render('register', { error: null }));
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!username || !password) return res.render('register', { error: 'Missing fields.' });
    const existingUser = await User.findOne({ username: username.trim() });
    if (existingUser) return res.render('register', { error: 'Username taken.' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username: username.trim(), password: hashedPassword });
    await newUser.save();
    res.redirect('/login');
  } catch (err) {
    if (err.code === 11000) return res.render('register', { error: 'Username already taken.' });
    res.render('register', { error: 'Error signing up.' });
  }
});

app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!username || !password) {
      return res.render('login', { error: 'Please enter both username and password.' });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render('login', { error: 'Invalid username or password.' });
    }

    req.session.userId = user._id;
    req.session.username = user.username;

    req.session.save((err) => {
      if (err) {
        console.error("Session Save Error:", err);
        return res.render('login', { error: 'Session allocation error.' });
      }
      res.redirect('/home');
    });

  } catch (err) {
    console.error("Login Route Exception:", err);
    res.render('login', { error: 'Login problem encountered.' });
  }
});

app.get('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  } else {
    res.redirect('/login');
  }
});

// --- GLOBAL BLOG POST ROUTES ---
app.get('/home', requireLogin, async (req, res) => {
  try {
    const activeUsername = req.session.username || 'User';
    const activeUserId = req.session.userId || null;

    // Fetch all posts safely
    const allPosts = await Post.find({}).sort({ createdAt: -1 }) || [];

    res.render('home', { 
      username: activeUsername, 
      currentUserId: activeUserId, 
      posts: allPosts 
    });
  } catch (err) {
    console.error("Home Timeline Error:", err);
    res.status(500).send("Database data parsing issue on the server.");
  }
});

app.post('/posts/new', requireLogin, async (req, res) => {
  const { title, content } = req.body;
  try {
    const newPost = new Post({ 
      title, 
      content, 
      author: req.session.username,
      authorId: req.session.userId 
    });
    await newPost.save();
    res.redirect('/home');
  } catch (err) {
    res.status(500).send("Failed to save post.");
  }
});

app.post('/posts/delete/:id', requireLogin, async (req, res) => {
  try {
    await Post.findOneAndDelete({ _id: req.params.id, authorId: req.session.userId });
    res.redirect('/home');
  } catch (err) {
    res.status(500).send("Error removing post.");
  }
});

// Global Fallback Error Catcher (Prevents the raw 500 white screen)
app.use((err, req, res, next) => {
  console.error("CRITICAL UNHANDLED SERVER CRASH:", err.stack);
  res.status(500).send("Something went wrong with the system layout. Check logs.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
