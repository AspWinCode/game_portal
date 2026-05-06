import { StudentHomeClient } from "../../components/student-home-client";

export const metadata = {
  title: "Игровой портал — для участников",
  description: "Войди в джем по коду от тренера и начни свою миссию."
};

export default function StudentPage() {
  return <StudentHomeClient />;
}
