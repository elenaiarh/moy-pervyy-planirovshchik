import webPush from "web-push";

const keys = webPush.generateVAPIDKeys();

process.stdout.write(`ASSIYA_VAPID_PUBLIC_KEY=${keys.publicKey}\n`);
process.stdout.write(`ASSIYA_VAPID_PRIVATE_KEY=${keys.privateKey}\n`);
process.stdout.write("ASSIYA_VAPID_SUBJECT=mailto:admin@myplaning.platunova-fin.ru\n");
process.stdout.write("ASSIYA_NOTIFICATION_TIMEZONE=Europe/Kirov\n");
