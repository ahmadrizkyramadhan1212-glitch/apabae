-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nip` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NULL,
    `role` ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER',
    `passwordHash` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_nip_key`(`nip`),
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Location` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('PHYSICAL', 'ONLINE', 'OTHER') NOT NULL,
    `capacity` INTEGER NULL,
    `facilities` VARCHAR(191) NULL,

    UNIQUE INDEX `Location_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Seminar` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `locationOther` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `topic` VARCHAR(191) NULL,
    `date` DATE NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `status` ENUM('MENUNGGU_VERIFIKASI', 'DIKEMBALIKAN', 'DIJADWALKAN', 'BERLANGSUNG', 'SELESAI', 'DIBATALKAN') NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI',
    `returnReason` VARCHAR(191) NULL,
    `letterReceived` BOOLEAN NOT NULL DEFAULT false,
    `cancelledBy` ENUM('ADMIN', 'USER') NULL,
    `cancelledAt` DATETIME(3) NULL,
    `attendToken` VARCHAR(191) NOT NULL,
    `attendCodeOn` BOOLEAN NOT NULL DEFAULT false,
    `attendCode` VARCHAR(191) NULL,
    `certTemplatePath` VARCHAR(191) NULL,
    `certPageMode` ENUM('A4_LANDSCAPE', 'A4_PORTRAIT', 'SQUARE', 'WIDE_16_9', 'AUTO') NOT NULL DEFAULT 'A4_LANDSCAPE',
    `certPageRatio` DOUBLE NULL,
    `certLayout` JSON NULL,
    `certMailSubject` VARCHAR(191) NULL,
    `certMailBody` TEXT NULL,
    `certGeneratedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Seminar_code_key`(`code`),
    UNIQUE INDEX `Seminar_attendToken_key`(`attendToken`),
    INDEX `Seminar_date_locationId_idx`(`date`, `locationId`),
    INDEX `Seminar_status_idx`(`status`),
    INDEX `Seminar_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeminarFile` (
    `id` VARCHAR(191) NOT NULL,
    `seminarId` VARCHAR(191) NOT NULL,
    `kind` ENUM('SURAT_IZIN', 'POSTER', 'LAINNYA') NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `storedPath` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SeminarFile_seminarId_idx`(`seminarId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Material` (
    `id` VARCHAR(191) NOT NULL,
    `seminarId` VARCHAR(191) NOT NULL,
    `presenter` VARCHAR(191) NOT NULL,
    `storedPath` VARCHAR(191) NULL,
    `originalName` VARCHAR(191) NULL,
    `sizeBytes` INTEGER NULL,
    `driveUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Material_seminarId_idx`(`seminarId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attendance` (
    `id` VARCHAR(191) NOT NULL,
    `seminarId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nip` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'QR',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Attendance_seminarId_email_key`(`seminarId`, `email`),
    UNIQUE INDEX `Attendance_seminarId_nip_key`(`seminarId`, `nip`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Certificate` (
    `id` VARCHAR(191) NOT NULL,
    `attendanceId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `pdfPath` VARCHAR(191) NULL,
    `mailStatus` ENUM('MENUNGGU', 'TERKIRIM', 'GAGAL') NOT NULL DEFAULT 'MENUNGGU',
    `mailError` TEXT NULL,
    `sentAt` DATETIME(3) NULL,

    UNIQUE INDEX `Certificate_attendanceId_key`(`attendanceId`),
    UNIQUE INDEX `Certificate_number_key`(`number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `News` (
    `id` VARCHAR(191) NOT NULL,
    `seminarId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `News_seminarId_key`(`seminarId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NewsPhoto` (
    `id` VARCHAR(191) NOT NULL,
    `newsId` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `caption` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `NewsPhoto_newsId_idx`(`newsId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `target` VARCHAR(191) NOT NULL,
    `detail` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailJob` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('AKUN_BARU', 'DISETUJUI', 'DIKEMBALIKAN', 'DIBATALKAN', 'SERTIFIKAT') NOT NULL,
    `toEmail` VARCHAR(191) NOT NULL,
    `toName` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `attachmentPath` VARCHAR(191) NULL,
    `attachmentName` VARCHAR(191) NULL,
    `certificateId` VARCHAR(191) NULL,
    `status` ENUM('MENUNGGU', 'TERKIRIM', 'GAGAL') NOT NULL DEFAULT 'MENUNGGU',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `nextTryAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,

    INDEX `EmailJob_status_nextTryAt_idx`(`status`, `nextTryAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Seminar` ADD CONSTRAINT `Seminar_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Seminar` ADD CONSTRAINT `Seminar_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeminarFile` ADD CONSTRAINT `SeminarFile_seminarId_fkey` FOREIGN KEY (`seminarId`) REFERENCES `Seminar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Material` ADD CONSTRAINT `Material_seminarId_fkey` FOREIGN KEY (`seminarId`) REFERENCES `Seminar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_seminarId_fkey` FOREIGN KEY (`seminarId`) REFERENCES `Seminar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Certificate` ADD CONSTRAINT `Certificate_attendanceId_fkey` FOREIGN KEY (`attendanceId`) REFERENCES `Attendance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `News` ADD CONSTRAINT `News_seminarId_fkey` FOREIGN KEY (`seminarId`) REFERENCES `Seminar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `News` ADD CONSTRAINT `News_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NewsPhoto` ADD CONSTRAINT `NewsPhoto_newsId_fkey` FOREIGN KEY (`newsId`) REFERENCES `News`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
