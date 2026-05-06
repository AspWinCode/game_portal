ALTER TABLE "User"
ADD COLUMN "password_hash" TEXT NOT NULL DEFAULT '';

UPDATE "User"
SET "password_hash" = 'scrypt$fb5d0ecdde73e6f0345edb6808a3b806$9419e8932adbab04295a2d7782d19f34fc8e758066b35c7eec2610160623a6ec55bb5dfc4ff45391bd33182da618a92a99514b56d6e07d7c9d4b97ead6b2f9d1'
WHERE "email" = 'admin@example.com';

UPDATE "User"
SET "password_hash" = 'scrypt$f3b0869bcb1fb2d09ba1106457027740$05b337c1d5d1b2c9ac73c6a251cb95e49d09e7675f833c0702d3e4afab023a67b94b7650260f2334991c9aff4f65a162346f4d66eebf29ade0b1340b1ca94665'
WHERE "email" = 'trainer@example.com';
