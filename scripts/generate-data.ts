import * as fs from 'fs';
import * as path from 'path';

interface User {
  id: number;
  name: string;
  email: string;
  avatar: string;
  bio: string;
}

interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
  date: string;
}

function generateUsers(count: number): User[] {
  const users: User[] = [];
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
  
  for (let i = 0; i < count; i++) {
    users.push({
      id: i + 1,
      name: `${names[i % names.length]} ${i + 1}`,
      email: `user${i + 1}@example.com`,
      avatar: `https://i.pravatar.cc/150?img=${(i % 70) + 1}`,
      bio: `Bio for user ${i + 1}. ${i % 3 === 0 ? 'Loves coding and coffee.' : i % 2 === 0 ? 'Passionate about design.' : 'Enthusiastic learner.'}`
    });
  }
  
  return users;
}

function generatePosts(count: number, userCount: number): Post[] {
  const posts: Post[] = [];
  const titles = [
    'Understanding Virtual Scrolling',
    'Best Practices for Angular',
    'Performance Optimization Tips',
    'Component Design Patterns',
    'State Management Solutions'
  ];
  
  for (let i = 0; i < count; i++) {
    const userId = (i % userCount) + 1;
    posts.push({
      id: i + 1,
      userId,
      title: `${titles[i % titles.length]} - Part ${i + 1}`,
      body: `This is the body content for post ${i + 1}. ${i % 2 === 0 ? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' : 'Short content.'}`,
      date: new Date(2024, 0, 1 + (i % 365)).toISOString()
    });
  }
  
  return posts;
}


const users = generateUsers(1000);

const posts = generatePosts(10000, 1000);

const dataDir = path.join(__dirname, '../public/data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

fs.writeFileSync(
  path.join(dataDir, 'users.json'),
  JSON.stringify(users, null, 2)
);
console.log('Saved users.json');

fs.writeFileSync(
  path.join(dataDir, 'posts.json'),
  JSON.stringify(posts, null, 2)
);
console.log('Saved posts.json');