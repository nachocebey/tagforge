-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "producedMana" TEXT[] DEFAULT ARRAY[]::TEXT[];
