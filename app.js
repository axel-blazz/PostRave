const express = require('express');
const userModel = require('./models/user');
const postModel = require('./models/post');
const cookieParser = require('cookie-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { log } = require('console');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index');
});

app.post('/register', async (req, res) => {
    const { username, name, age, email, password } = req.body;
    let user = await userModel.findOne({ email });
    if (user) 
        return res.status(500).send('User already exists');
    
    // hash the password
    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            const user = await userModel.create({ username, name, age, email, password: hash });
            // create a token
            const token = jwt.sign({ email, userid: user._id }, 'secret');
            res.cookie('token', token);
            res.send('User created');
        });
    });

});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    let user = await userModel.findOne({ email });
    if (!user) 
        return res.status(400).send('Something went wrong');
    
    bcrypt.compare(password, user.password, (err, result) => {
        if(result) {
            const token = jwt.sign({ email, userid: user._id }, 'secret');
            res.cookie('token', token);
            res.status(200).redirect('/profile');
        }
        else res.status(400).send('Something went wrong');
    })

});



app.get('/logout', (req, res) => {
    res.cookie('token', '');
    res.render('login');
});

// Creating middleware for protected routes (DONT PUT THIS IN THE LOGIN ROUTE) -> PUT THIS IN THE PROFILE ROUTE
let isLoggedIn = (req, res, next) => {
    if(req.cookies.token === "") res.redirect('/login');
    else {
        let decoded = jwt.verify(req.cookies.token, 'secret')
        req.user = decoded;
        next()
    }

}

app.get('/profile', isLoggedIn, async (req, res) => {
    const email = req.user.email;
    const user = await userModel.findOne({ email }).populate('posts');
    res.render('profile', { user });
});

app.get('/like/:id', isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({ _id: req.params.id }).populate('user');
    const userId = req.user.userid;
    const likeIndex = post.likes.indexOf(userId);
    
    if (likeIndex === -1) {
        post.likes.push(userId);
    } else {
        post.likes.splice(likeIndex, 1);
    }
    
    await post.save();
    res.redirect('/profile');
});

app.get('/edit/:id', isLoggedIn, async (req, res) => {
    const id = req.params.id;
    const post = await postModel.findOne({ _id: id });
    res.render('edit', { post });
});


app.post('/update/:id', isLoggedIn, async (req, res) => {
    let id = req.params.id;
    let content = req.body.content;
    let post = await postModel.findOne({ _id: id });
    post.content = content;
    await post.save();
    res.redirect('/profile');
});

app.post('/post', isLoggedIn, async (req, res) => {
    const {content} = req.body;
    const email = req.user.email;
    let user = await userModel.findOne({ email });
    const post = await postModel.create({ user: user._id, content });

    user.posts.push(post._id);
    await user.save();
    res.redirect('/profile');
});

app.listen(3000);