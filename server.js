require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

// Database Connection using secure environment variable
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// --- DATA SCHEMAS & MODELS ---
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', PostSchema);

// --- MIDDLEWARES ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000, httpOnly: true } // Secure 1-hour session cookie
}));

// Route static files safely from the public folder
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Auth Guard Middleware
const requireLogin = (req, res, next) => {
  if (!req.session.userId) return res.redirect('/login');
  next();
};

// --- AUTH ROUTES ---
app.get('/', (req, res) => res.redirect('/home'));

app.get('/register', (req, res) => res.render('register', { error: null }));
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.render('register', { error: 'Username already taken.' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    res.redirect('/login');
  } catch (err) {
    res.render('register', { error: 'Error signing up.' });
  }
});

app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render('login', { error: 'Invalid username or password.' });
    }
    req.session.userId = user._id;
    res.redirect('/home');
  } catch (err) {
    res.render('login', { error: 'Login problem encountered.' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

// --- BLOG POST CRUD ROUTES ---

// READ Posts
app.get('/home', requireLogin, async (req, res) => {
  const user = await User.findById(req.session.userId);
  const posts = await Post.find({ author: req.session.userId }).sort({ createdAt: -1 });
  res.render('home', { username: user.username, posts });
});

// CREATE Post
app.post('/posts/new', requireLogin, async (req, res) => {
  const { title, content } = req.body;
  try {
    const newPost = new Post({ title, content, author: req.session.userId });
    await newPost.save();
    res.redirect('/home');
  } catch (err) {
    res.status(500).send("Failed to save post.");
  }
});

// UPDATE: Render Form
app.get('/posts/edit/:id', requireLogin, async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, author: req.session.userId });
  if (!post) return res.status(404).send("Post not found.");
  res.render('edit', { post });
});

// UPDATE: Process Changes
app.post('/posts/edit/:id', requireLogin, async (req, res) => {
  const { title, content } = req.body;
  await Post.findOneAndUpdate({ _id: req.params.id, author: req.session.userId }, { title, content });
  res.redirect('/home');
});

// DELETE Post
app.post('/posts/delete/:id', requireLogin, async (req, res) => {
  await Post.findOneAndDelete({ _id: req.params.id, author: req.session.userId });
  res.redirect('/home');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server launched on http://localhost:${PORT}`));
