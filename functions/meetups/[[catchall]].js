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

	if (url.pathname === '/meetups') {
		return renderForumsPage(session.username, env);
	} else if (url.pathname.startsWith('/meetups/topic/')) {
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

	if (url.pathname === "/meetups/add-topic") {
		const title = formData.get('title').trim();
		const emailGroup = formData.get('email_group').trim();
		const description = formData.get('description').trim();
		const meetingType = formData.get('meeting_type').trim();
		const locationOrLink = meetingType === 'InPerson' ? formData.get('location').trim() : formData.get('link').trim();
		const datetime = formData.get('datetime').trim();
		return addTopic(title, emailGroup, description, meetingType, locationOrLink, datetime, session.username, env);
	} else if (url.pathname.startsWith("/meetups/delete-topic/")) {
		const topicId = url.pathname.split('/')[3];
		return deleteTopic(topicId, session.username, env);
	} else if (url.pathname.startsWith("/meetups/topic/") && url.pathname.endsWith('/add-post')) {
		const topicId = url.pathname.split('/')[3];
		const title = formData.get('title');
		const body = formData.get('body');
		return addPost(title, body, topicId, session.username, env);
	} else if (url.pathname.startsWith("/meetups/topic/") && url.pathname.endsWith('/delete-post')) {
		const postId = formData.get('post_id');
		const topicId = formData.get('topic_id');
		return deletePost(postId, topicId, session.username, env);
	}

	return new Response("Bad Request", {
		status: 400
	});
}

export async function renderForumsPage(username, env) {
	let user = await env.COOLFROG_USERS.get(username);
	user = JSON.parse(user);

	// Extracting unique email domains for the dropdown and preparing to fetch topics separately
	const emailDomains = [...new Set(user.emails.map(email => email.email.split('@')[1]))];
	const emailGroupOptions = emailDomains.map(domain => `<option value="${domain}">@${domain}</option>`).join('');

	let pageHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css">
            <title>Meetups Page</title>
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
        .content {
            padding: 20px;
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
                <h1>Meetups Topics</h1>`;

	for (let domain of emailDomains) {
		let topics = await fetchTopicsByEmailGroup(domain, env);
		const topicsHtml = topics.map(topic => `
            <tr>
                <td style="width: 70%;"><a href="/meetups/topic/${topic.id}">${topic.title}</a></td>
                <td style="width: 20%;">${topic.username}</td>
                <td style="width: 10%;">
                ${username === topic.username ? `<form action="/meetups/delete-topic/${topic.id}" method="post"><button type="submit" class="btn btn-danger">Delete</button></form>` : ''}</td>
            </tr>
        `).join('');

		pageHtml += `
                <div class="email-group-section">
                    <h2>@${domain} Meetups</h2>
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
                </div>`;
	}

	pageHtml += `
                <form method="post" action="/meetups/add-topic">
                    <input type="text" name="title" placeholder="Enter meetup title" class="form-control mb-2" required>
                    <select name="email_group" class="form-control mb-2">${emailGroupOptions}</select>
                    <textarea name="description" class="form-control mb-2" placeholder="Enter description" required></textarea>
                    <select name="meeting_type" class="form-control mb-2" required onchange="toggleLocationLink(this.value)">
                        <option value="InPerson">In Person</option>
                        <option value="Online">Online</option>
                    </select>
                    <input type="text" name="location" placeholder="Enter location" class="form-control mb-2" hidden>
                    <input type="url" name="link" placeholder="Enter online meeting link" class="form-control mb-2" hidden>
                    <input type="datetime-local" name="datetime" class="form-control mb-2" required>
                    <button type="submit" class="btn btn-primary">Add Meetup</button>
                </form>
            </div>
            <script>
                function toggleLocationLink(value) {
                    const locationInput = document.querySelector('input[name="location"]');
                    const linkInput = document.querySelector('input[name="link"]');
                    if (value === 'InPerson') {
                        locationInput.hidden = false;
                        linkInput.hidden = true;
                    } else {
                        locationInput.hidden = true;
                        linkInput.hidden = false;
                    }
                }
                document.addEventListener('DOMContentLoaded', function() {
                    // Default to 'In Person' on initial load
                    toggleLocationLink(document.querySelector('select[name="meeting_type"]').value);
                });
            </script>
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

	// Pinned topic information card
	const topicInformationHtml = `
        <div class="card mb-3">
            <div class="card-body">
                <h5 class="card-title">${topic.title}</h5>
                <h6 class="card-subtitle mb-2 text-muted">Scheduled for ${new Date(topic.datetime).toLocaleString()}</h6>
                <p class="card-text">${topic.description}</p>
                ${topic.meeting_type === 'InPerson' ?
                    `<p class="card-text"><strong>Location:</strong> ${topic.location_or_link}</p>` :
                    `<p class="card-text"><strong>Meeting Link:</strong> <a href="${topic.location_or_link}" target="_blank">${topic.location_or_link}</a></p>`
                }
                <p class="card-text"><strong>Email Group:</strong> @${topic.email_group}</p>
            </div>
        </div>
    `;

	const postsHtml = posts.map(post => `
        <div class="card mb-3">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span>@${post.username}</span>
                ${username === post.username ? `<form action="/meetups/topic/${topicId}/delete-post" method="post" class="mb-0">
    <input type="hidden" name="post_id" value="${post.id}">
    <input type="hidden" name="topic_id" value="${topicId}"> <!-- Include the topic ID -->
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
        .content {
            padding: 20px;
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
                <a href="/meetups" class="btn btn-primary mb-3">Back to Meetups</a>
                ${topicInformationHtml}
                ${postsHtml}
                <form method="post" action="/meetups/topic/${topicId}/add-post">
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


export async function addTopic(title, emailGroup, description, meetingType, locationOrLink, datetime, username, env) {
	const stmt = env.COOLFROG_MEETUPS.prepare("INSERT INTO topics (id, title, email_group, description, meeting_type, location_or_link, datetime, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
	await stmt.bind(uuidv4(), title, emailGroup, description, meetingType, locationOrLink, datetime, username).run();
	return new Response(null, {
		status: 303,
		headers: {
			'Location': '/meetups'
		}
	});
}

export async function addPost(title, body, topicId, username, env) {
	const stmt = env.COOLFROG_MEETUPS.prepare("INSERT INTO posts (id, title, body, topic_id, username) VALUES (?, ?, ?, ?, ?)");
	await stmt.bind(uuidv4(), title, body, topicId, username).run();
	return new Response(null, {
		status: 303,
		headers: {
			'Location': `/meetups/topic/${topicId}`
		}
	});
}

export async function fetchTopicsByEmailGroup(emailDomain, env) {
	const stmt = env.COOLFROG_MEETUPS.prepare("SELECT id, title, username FROM topics WHERE email_group = ?");
	return (await stmt.bind(emailDomain).all()).results;
}

export async function fetchTopicById(topicId, env) {
	const stmt = env.COOLFROG_MEETUPS.prepare("SELECT id, title, email_group, description, meeting_type, location_or_link, datetime, username FROM topics WHERE id = ?");
	return (await stmt.bind(topicId).all()).results;
}

export async function fetchPostsForTopic(topicId, env) {
	const stmt = env.COOLFROG_MEETUPS.prepare("SELECT id, title, body, username, post_date FROM posts WHERE topic_id = ? ORDER BY post_date DESC");
	return (await stmt.bind(topicId).all()).results;
}

export async function deleteTopic(topicId, username, env) {
	const stmt = env.COOLFROG_MEETUPS.prepare("DELETE FROM topics WHERE id = ? AND username = ?");
	await stmt.bind(topicId, username).run();
	return new Response(null, {
		status: 204,
		headers: {
			'Location': '/meetups'
		}
	});
}

export async function deletePost(postId, topicId, username, env) {
	const stmt = env.COOLFROG_MEETUPS.prepare("DELETE FROM posts WHERE id = ? AND username = ?");
	await stmt.bind(postId, username).run();
	return new Response(null, {
		status: 204,
		headers: {
			'Location': `/meetups/topic/${topicId}`
		}
	});
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