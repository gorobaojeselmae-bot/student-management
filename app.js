
const express = require('express');
const mysql = require('mysql2');

const app = express();

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'student_management'
});

let dbConnected = false;

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        dbConnected = false;
        return;
    }

    dbConnected = true;
    console.log('Connected to MySQL');
});

// Handle database errors
db.on('error', (err) => {
    console.error('Database error:', err.message);

    if (err.fatal) {
        dbConnected = false;
        console.error('Database disconnected. Check MySQL server.');
    }
});

// Middleware
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Check database connection before database-dependent routes
app.use((req, res, next) => {
    if (!dbConnected) {
        return res.status(503).send(
            'Database disconnected. Please start MySQL and restart the application.'
        );
    }

    next();
});

// Display student list
app.get('/', (req, res) => {
    db.query(
        'SELECT * FROM students ORDER BY id DESC',
        (err, results) => {
            if (err) {
                console.error('Error fetching students:', err.message);
                return res.status(500).send('Unable to load students.');
            }

            res.render('index', {
                students: results,
                keyword: ''
            });
        }
    );
});

// Display student list at /students
app.get('/students', (req, res) => {
    db.query(
        'SELECT * FROM students ORDER BY id DESC',
        (err, results) => {
            if (err) {
                console.error('Error fetching students:', err.message);
                return res.status(500).send('Unable to load students.');
            }

            res.render('index', {
                students: results,
                keyword: ''
            });
        }
    );
});

// Show Add Student form
app.get('/students/add', (req, res) => {
    res.render('add');
});

// Add student
app.post('/students/add', (req, res) => {
    const {
        student_id,
        first_name,
        last_name,
        course,
        year_level,
        email
    } = req.body;

    // Server-side validation
    if (
        !student_id?.trim() ||
        !first_name?.trim() ||
        !last_name?.trim() ||
        !course?.trim() ||
        !year_level ||
        !email?.trim()
    ) {
        return res.status(400).send('All fields are required.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).send('Invalid email address.');
    }

    const sql = `
        INSERT INTO students
        (student_id, first_name, last_name, course, year_level, email)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [
        student_id.trim(),
        first_name.trim(),
        last_name.trim(),
        course.trim(),
        year_level,
        email.trim()
    ];

    db.query(sql, values, (err) => {
        if (err) {
            console.error('Error adding student:', err.message);
            return res.status(500).send('Unable to save student.');
        }

        res.redirect('/');
    });
});

// Search students
app.get('/students/search', (req, res) => {
    const keyword = (req.query.keyword || '').trim();
    const searchValue = `%${keyword}%`;

    const sql = `
        SELECT * FROM students
        WHERE student_id LIKE ?
           OR first_name LIKE ?
           OR last_name LIKE ?
           OR course LIKE ?
           OR email LIKE ?
        ORDER BY id DESC
    `;

    db.query(
        sql,
        [
            searchValue,
            searchValue,
            searchValue,
            searchValue,
            searchValue
        ],
        (err, results) => {
            if (err) {
                console.error('Search error:', err.message);
                return res.status(500).send('Unable to search students.');
            }

            res.render('index', {
                students: results,
                keyword: keyword
            });
        }
    );
});

// Show Edit Student form
app.get('/students/edit/:id', (req, res) => {
    const studentId = req.params.id;

    db.query(
        'SELECT * FROM students WHERE id = ?',
        [studentId],
        (err, results) => {
            if (err) {
                console.error('Error fetching student:', err.message);
                return res.status(500).send('Unable to load student.');
            }

            if (results.length === 0) {
                return res.status(404).send('Student not found.');
            }

            res.render('edit', {
                student: results[0]
            });
        }
    );
});

// Update student
app.post('/students/edit/:id', (req, res) => {
    const studentId = req.params.id;

    const {
        student_id,
        first_name,
        last_name,
        course,
        year_level,
        email
    } = req.body;

    if (
        !student_id?.trim() ||
        !first_name?.trim() ||
        !last_name?.trim() ||
        !course?.trim() ||
        !year_level ||
        !email?.trim()
    ) {
        return res.status(400).send('All fields are required.');
    }

    if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        !Number.isInteger(Number(year_level)) ||
        Number(year_level) < 1 ||
        Number(year_level) > 5
    ) {
        return res.status(400).send('Please check the email and year level.');
    }

    const sql = `
        UPDATE students
        SET student_id = ?,
            first_name = ?,
            last_name = ?,
            course = ?,
            year_level = ?,
            email = ?
        WHERE id = ?
    `;

    const values = [
        student_id.trim(),
        first_name.trim(),
        last_name.trim(),
        course.trim(),
        Number(year_level),
        email.trim(),
        studentId
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error updating student:', err.message);
            return res.status(500).send('Unable to update student.');
        }

        if (result.affectedRows === 0) {
            // Check whether the student exists if no values changed.
            db.query(
                'SELECT id FROM students WHERE id = ?',
                [studentId],
                (checkErr, rows) => {
                    if (checkErr) {
                        console.error('Error checking student:', checkErr.message);
                        return res.status(500).send('Database error.');
                    }

                    if (rows.length === 0) {
                        return res.status(404).send('Student not found.');
                    }

                    return res.redirect('/');
                }
            );

            return;
        }

        res.redirect('/');
    });
});

// Delete student
app.post('/students/delete/:id', (req, res) => {
    const studentId = req.params.id;

    db.query(
        'DELETE FROM students WHERE id = ?',
        [studentId],
        (err, result) => {
            if (err) {
                console.error('Error deleting student:', err.message);
                return res.status(500).send('Unable to delete student.');
            }

            if (result.affectedRows === 0) {
                return res.status(404).send('Student not found.');
            }

            res.redirect('/');
        }
    );
});

// Start server
app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});
