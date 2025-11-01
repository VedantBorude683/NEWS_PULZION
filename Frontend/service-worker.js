// Frontend/service-worker.js (Complete New File)

console.log("Service Worker: Loaded.");

// Listener for the 'push' event
// This is triggered when the server sends a notification
self.addEventListener('push', e => {
  const data = e.data.json(); // Get the { title, body } object from our server
  
  console.log("Service Worker: Push Received.");
  console.log(`Service Worker: Title: ${data.title}, Body: ${data.body}`);

  const title = data.title || "NewsPulse";
  const options = {
    body: data.body || "You have a new update.",
    icon: './assets/icon-192.png', // You'll need to create this image
    badge: './assets/badge-72.png'   // You'll need this one too
  };

  // Tell the browser to show the notification
  e.waitUntil(self.registration.showNotification(title, options));
});