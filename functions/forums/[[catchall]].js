import {
	v4 as uuidv4
} from 'uuid';

export async function onRequestGet({
	request,
	env
}) {
	const url = new URL(request.url);
	const sessionCookie = getSessionCookie(request);
	let session;

	if (!sessionCookie || !(session = JSON.parse(await env.COOLFROG_SESSIONS.get(sessionCookie)))) {
		return unauthorizedResponse();
	}

	if (url.pathname === '/forums') {
		return renderForumsPage(session.username, env);
	} else if (url.pathname.startsWith('/forums/topic/')) {
		const topicId = url.pathname.split('/')[3];
		return renderTopicPage(topicId, session.username, env);
	}

	return new Response("Resource Not Found", {
		status: 404
	});
}

export async function onRequestPost({
	request,
	env
}) {
	const url = new URL(request.url);
	const formData = await request.formData();
	const sessionCookie = getSessionCookie(request);
	let session;

	if (!sessionCookie || !(session = JSON.parse(await env.COOLFROG_SESSIONS.get(sessionCookie)))) {
		return unauthorizedResponse();
	}

	if (url.pathname === "/forums/add-topic") {
		const title = formData.get('title').trim();
		return addTopic(title, session.username, env);
	} else if (url.pathname.startsWith("/forums/delete-topic/")) {
		const topicId = url.pathname.split('/')[3];
		return deleteTopic(topicId, session.username, env);
	} else if (url.pathname.startsWith("/forums/topic/") && url.pathname.endsWith('/add-post')) {
		const topicId = url.pathname.split('/')[3];
		const title = formData.get('title');
		const body = formData.get('body');
		return addPost(title, body, topicId, session.username, env);
	} else if (url.pathname.startsWith("/forums/topic/") && url.pathname.endsWith('/delete-post')) {
		const postId = formData.get('post_id');
		return deletePost(postId, session.username, env);
	}

	return new Response("Bad Request", {
		status: 400
	});
}

export async function renderForumsPage(username, env) {
	let topics = await fetchTopics(env);

	const topicsHtml = topics.map(topic => `
    <tr>
        <td style="width: 70%;"><a href="/forums/topic/${topic.id}">${topic.title}</a></td>
        <td style="width: 20%;">${topic.username}</td>
        <td style="width: 10%;">${username === topic.username ? `<form action="/forums/delete-topic/${topic.id}" method="post"><button type="submit" class="btn btn-danger">Delete</button></form>` : ''}</td>
    </tr>
`).join('');

	const pageHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css">
            <title>Forum Page</title>
    <style>
        body {
            padding-top: 80px; /* Padding to ensure content isn't hidden behind fixed header */
        }
        .fixed-header {
            position: fixed;
            top: 0;
            width: 100%;
            z-index: 1000;
        }
        .navbar-brand img {
            height: 40px;
        }
    </style>
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            function toggleFixedHeader() {
                const header = document.querySelector('.fixed-header');
                if (window.scrollY > header.offsetTop) {
                    header.classList.add('fixed-top', 'bg-dark', 'navbar-dark');
                } else {
                    header.classList.remove('fixed-top', 'bg-dark', 'navbar-dark');
                }
            }
            window.addEventListener('scroll', toggleFixedHeader);
        });
    </script>
        </head>
        <body>
    <header class="fixed-header navbar navbar-expand-lg navbar-light bg-light">
        <div class="container">
            <a class="navbar-brand" href="/index">
                <img src="/cdn/coolfrog.png" alt="logo">
            </a>
            <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav" 
                    aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ml-auto">
                    <li class="nav-item"><a class="nav-link" href="/index">Home</a></li>
                    <li class="nav-item"><a class="nav-link" href="/forums">Forums</a></li>
                    <li class="nav-item"><a class="nav-link" href="/meetups">Meetups</a></li>
                    <li class="nav-item"><a class="nav-link" href="/videopage">Videos</a></li>
                    <li class="nav-item"><a class="nav-link" href="/article_library">Articles</a></li>
                    <li class="nav-item"><a class="nav-link" href="/dailyInteractive">Daily Interactive</a></li>
                    <li class="nav-item"><a class="nav-link" href="/relaxation-sounds">Relaxation Sounds</a></li>
                    <li class="nav-item"><a class="nav-link" href="/MeditationSession">Meditation Sessions</a></li>
                    <li class="nav-item"><a class="nav-link" href="/timersPage">Timers</a></li>
                    <li class="nav-item"><a class="nav-link" href="/WellnessChallenges">Wellness Challenges</a></li>
                </ul>
            </div>
        </div>
    </header>
    <div class="container mt-5">
        <div class="row justify-content-end">
            <div class="col-auto">
                <button id="leftButton" class="btn btn-primary btn-lg">Sign Up</button>
                <button id="rightButton" class="btn btn-secondary btn-lg">Login</button>
            </div>
        </div>
            <div class="container mt-4">
                <h1>Forum Topics</h1>
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Author</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>${topicsHtml}</tbody>
                </table>
                <form method="post" action="/forums/add-topic">
                    <input type="text" name="title" placeholder="Enter topic title" class="form-control mb-2" required>
                    <button type="submit" class="btn btn-primary">Add Topic</button>
                </form>
            </div>
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const leftButton = document.getElementById('leftButton');
            const rightButton = document.getElementById('rightButton');

            fetch('/api/username').then(response => response.json()).then(data => {
                if (data.username) {
                    leftButton.textContent = 'Account';
                    leftButton.onclick = function () { window.location.href = '/account'; };
                    rightButton.textContent = 'Sign Out of ' + data.username;
                    rightButton.onclick = function () { window.location.href = '/signout'; };
                } else {
                    leftButton.textContent = 'Sign Up';
                    leftButton.onclick = function () { window.location.href = '/signup'; };
                    rightButton.textContent = 'Login';
                    rightButton.onclick = function () { window.location.href = '/login'; };
                }
            }).catch(error => {
                console.error("Error fetching username:", error);
                leftButton.textContent = 'Sign Up';
                leftButton.onclick = function () { window.location.href = '/signup'; };
                rightButton.textContent = 'Login';
                rightButton.onclick = function () { window.location.href = '/login'; };
            });
        });
    </script>
        </body>
        </html>
    `;

	return new Response(pageHtml, {
		headers: {
			'Content-Type': 'text/html'
		}
	});
}

export async function renderTopicPage(topicId, username, env) {
	let topic = (await fetchTopicById(topicId, env))[0];
	let posts = await fetchPostsForTopic(topicId, env);

	const postsHtml = posts.map(post => `
        <div class="card mb-3">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span>@${post.username}</span>
                ${username === post.username ? `<form action="/forums/topic/${topicId}/delete-post" method="post" class="mb-0">
                    <input type="hidden" name="post_id" value="${post.id}">
                    <button type="submit" class="btn btn-danger btn-sm">Delete</button>
                </form>` : ''}
            </div>
            <div class="card-body">
                <h5 class="card-title">${post.title}</h5>
                <p class="card-text">${post.body}</p>
            </div>
            <div class="card-footer text-muted">
                ${new Date(post.post_date).toLocaleString()}
            </div>
        </div>
    `).join('');

	const pageHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css">
            <title>Posts in ${topic.title}</title>
            <style>
                body {
                    padding-top: 80px; /* Padding to ensure content isn't hidden behind fixed header */
                }
                .fixed-header {
                    position: fixed;
                    top: 0;
                    width: 100%;
                    z-index: 1000;
                }
                .navbar-brand img {
                    height: 40px;
                }
            </style>
            <script>
                document.addEventListener('DOMContentLoaded', function () {
                    function toggleFixedHeader() {
                        const header = document.querySelector('.fixed-header');
                        if (window.scrollY > header.offsetTop) {
                            header.classList.add('fixed-top', 'bg-dark', 'navbar-dark');
                        } else {
                            header.classList.remove('fixed-top', 'bg-dark', 'navbar-dark');
                        }
                    }
                    window.addEventListener('scroll', toggleFixedHeader);
                });
            </script>
        </head>
        <body>
    <header class="fixed-header navbar navbar-expand-lg navbar-light bg-light">
        <div class="container">
            <a class="navbar-brand" href="/index">
                <img src="/cdn/coolfrog.png" alt="logo">
            </a>
            <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav" 
                    aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ml-auto">
                    <li class="nav-item"><a class="nav-link" href="/index">Home</a></li>
                    <li class="nav-item"><a class="nav-link" href="/forums">Forums</a></li>
                    <li class="nav-item"><a class="nav-link" href="/meetups">Meetups</a></li>
                    <li class="nav-item"><a class="nav-link" href="/videopage">Videos</a></li>
                    <li class="nav-item"><a class="nav-link" href="/article_library">Articles</a></li>
                    <li class="nav-item"><a class="nav-link" href="/dailyInteractive">Daily Interactive</a></li>
                    <li class="nav-item"><a class="nav-link" href="/relaxation-sounds">Relaxation Sounds</a></li>
                    <li class="nav-item"><a class="nav-link" href="/MeditationSession">Meditation Sessions</a></li>
                    <li class="nav-item"><a class="nav-link" href="/timersPage">Timers</a></li>
                    <li class="nav-item"><a class="nav-link" href="/WellnessChallenges">Wellness Challenges</a></li>
                </ul>
            </div>
        </div>
    </header>
    <div class="container mt-5">
        <div class="row justify-content-end">
            <div class="col-auto">
                <button id="leftButton" class="btn btn-primary btn-lg">Sign Up</button>
                <button id="rightButton" class="btn btn-secondary btn-lg">Login</button>
            </div>
        </div>
            <div class="container mt-5">
                <h1>${topic.title}</h1>
                <a href="/forums" class="btn btn-primary mb-3">Back to Topics</a>
                ${postsHtml}
                <form method="post" action="/forums/topic/${topicId}/add-post">
                    <input type="text" name="title" placeholder="Enter post title" class="form-control mb-2" required>
                    <textarea name="body" class="form-control mb-2" placeholder="Enter post body" required></textarea>
                    <button type="submit" class="btn btn-success">Add Post</button>
                </form>
            </div>
            <script>
                document.addEventListener('DOMContentLoaded', function () {
                    const leftButton = document.getElementById('leftButton');
                    const rightButton = document.getElementById('rightButton');

                    fetch('/api/username').then(response => response.json()).then(data => {
                        if (data.username) {
                            leftButton.textContent = 'Account';
                            leftButton.onclick = function () { window.location.href = '/account'; };
                            rightButton.textContent = 'Sign Out of ' + data.username;
                            rightButton.onclick = function () { window.location.href = '/signout'; };
                        } else {
                            leftButton.textContent = 'Sign Up';
                            leftButton.onclick = function () { window.location.href = '/signup'; };
                            rightButton.textContent = 'Login';
                            rightButton.onclick = function () { window.location.href = '/login'; };
                        }
                    }).catch(error => {
                        console.error("Error fetching username:", error);
                        leftButton.textContent = 'Sign Up';
                        leftButton.onclick = function () { window.location.href = '/signup'; };
                        rightButton.textContent = 'Login';
                        rightButton.onclick = function () { window.location.href = '/login'; };
                    });
                });
            </script>
        </body>
        </html>
    `;

	return new Response(pageHtml, {
		headers: {
			'Content-Type': 'text/html'
		}
	});
}


export async function addTopic(title, username, env) {
	const stmt = env.COOLFROG_FORUM.prepare("INSERT INTO topics (id, title, username) VALUES (?, ?, ?)");
	await stmt.bind(uuidv4(), title, username).run();
	return new Response(null, {
		status: 303,
		headers: {
			'Location': '/forums'
		}
	});
}

export async function deleteTopic(topicId, username, env) {
	const stmt = env.COOLFROG_FORUM.prepare("DELETE FROM topics WHERE id = ? AND username = ?");
	await stmt.bind(topicId, username).run();
	return new Response(null, {
		status: 204
	});
}

export async function addPost(title, body, topicId, username, env) {
	const stmt = env.COOLFROG_FORUM.prepare("INSERT INTO posts (id, title, body, topic_id, username) VALUES (?, ?, ?, ?, ?)");
	await stmt.bind(uuidv4(), title, body, topicId, username).run();
	return new Response(null, {
		status: 303,
		headers: {
			'Location': `/forums/topic/${topicId}`
		}
	});
}

export async function deletePost(postId, username, env) {
	const stmt = env.COOLFROG_FORUM.prepare("DELETE FROM posts WHERE id = ? AND username = ?");
	await stmt.bind(postId, username).run();
	return new Response(null, {
		status: 204
	});
}

export async function fetchTopics(env) {
	const stmt = env.COOLFROG_FORUM.prepare("SELECT id, title, username FROM topics ORDER BY title");
	return (await stmt.all()).results;
}

export async function fetchTopicById(topicId, env) {
	const stmt = env.COOLFROG_FORUM.prepare("SELECT id, title, username FROM topics WHERE id = ?");
	return (await stmt.bind(topicId).all()).results;
}

export async function fetchPostsForTopic(topicId, env) {
	const stmt = env.COOLFROG_FORUM.prepare("SELECT id, title, body, username, post_date FROM posts WHERE topic_id = ? ORDER BY post_date DESC");
	return (await stmt.bind(topicId).all()).results;
}

export function getSessionCookie(request) {
	const cookieHeader = request.headers.get('Cookie');
	if (!cookieHeader) return null;
	const cookies = cookieHeader.split(';').map(cookie => cookie.trim().split('='));
	return Object.fromEntries(cookies)['session-id'];
}

export function unauthorizedResponse() {
	return new Response("Unauthorized - Please log in.", {
		status: 403,
		headers: {
			'Content-Type': 'text/plain'
		}
	});
}