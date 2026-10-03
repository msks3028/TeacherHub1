import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { PlatformProvider } from "./context/PlatformContext";
import { ConfirmProvider } from "./context/ConfirmContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import DashboardLayout from "./components/layout/DashboardLayout";
import { EmptyState, LoadingState } from "./components/common/StateViews";
import Button from "./components/ui/Button";
import PwaExperience from "./components/common/PwaExperience";

import LoginPage from "./pages/auth/LoginPage";
const QrLoginPage = lazy(() => import("./pages/auth/QrLoginPage"));

const TeacherDashboard = lazy(() => import("./pages/teacher/TeacherDashboard"));
const TeacherAnalyticsPage = lazy(() => import("./pages/teacher/AnalyticsPage"));
const TeacherLiveClassesPage = lazy(() => import("./pages/teacher/LiveClassesPage"));
const StudentLiveClassesPage = lazy(() => import("./pages/student/LiveClassesPage"));
const LiveClassRoomPage = lazy(() => import("./pages/shared/LiveClassRoomPage"));
const SecuritySettingsPage = lazy(() => import("./pages/shared/SecuritySettingsPage"));
const StudentsPage = lazy(() => import("./pages/teacher/StudentsPage"));
const CoursesPage = lazy(() => import("./pages/teacher/CoursesPage"));
const CourseDetailPage = lazy(() => import("./pages/teacher/CourseDetailPage"));
const VideosPage = lazy(() => import("./pages/teacher/VideosPage"));
const HomeworkPage = lazy(() => import("./pages/teacher/HomeworkPage"));
const MaterialsPage = lazy(() => import("./pages/teacher/MaterialsPage"));
const ExamsPage = lazy(() => import("./pages/teacher/ExamsPage"));
const AnnouncementsPage = lazy(() => import("./pages/teacher/AnnouncementsPage"));
const TeacherProfilePage = lazy(() => import("./pages/teacher/ProfilePage"));
const AppearancePage = lazy(() => import("./pages/teacher/AppearancePage"));

const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard"));
const StudentCoursesPage = lazy(() => import("./pages/student/CoursesPage"));
const StudentCourseDetailPage = lazy(() => import("./pages/student/CourseDetailPage"));
const StudentLessonDetailPage = lazy(() => import("./pages/student/LessonDetailPage"));
const StudentVideosPage = lazy(() => import("./pages/student/VideosPage"));
const StudentHomeworkPage = lazy(() => import("./pages/student/HomeworkPage"));
const StudentExamsPage = lazy(() => import("./pages/student/ExamsPage"));
const StudentMaterialsPage = lazy(() => import("./pages/student/MaterialsPage"));
const StudentResultsPage = lazy(() => import("./pages/student/ResultsPage"));
const StudentAiAssistantPage = lazy(() => import("./pages/student/AiAssistantPage"));
const StudentAnnouncementsPage = lazy(() => import("./pages/student/AnnouncementsPage"));
const StudentProfilePage = lazy(() => import("./pages/student/ProfilePage"));

const NotificationsPage = lazy(() => import("./pages/shared/NotificationsPage"));

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "TEACHER" ? "/teacher" : "/student"} replace />;
}

function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center bg-surface p-6">
      <EmptyState
        illustration="search"
        title="الصفحة دي مش موجودة"
        message="ممكن الرابط اتغيّر أو اتكتب غلط."
        action={<Button as={Link} to="/">الرجوع للرئيسية</Button>}
      />
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/qr-login/:token" element={<QrLoginPage />} />
      <Route path="/" element={<RootRedirect />} />

      <Route element={<ProtectedRoute allowedRoles={["TEACHER"]} />}>
        <Route element={<DashboardLayout role="TEACHER" />}>
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/analytics" element={<TeacherAnalyticsPage />} />
          <Route path="/teacher/live-classes" element={<TeacherLiveClassesPage />} />
          <Route path="/teacher/live-classes/:liveClassId/room" element={<LiveClassRoomPage />} />
          <Route path="/teacher/security" element={<SecuritySettingsPage />} />
          <Route path="/teacher/students" element={<StudentsPage />} />
          <Route path="/teacher/courses" element={<CoursesPage />} />
          <Route path="/teacher/courses/:courseId" element={<CourseDetailPage />} />
          <Route path="/teacher/videos" element={<VideosPage />} />
          <Route path="/teacher/homework" element={<HomeworkPage />} />
          <Route path="/teacher/materials" element={<MaterialsPage />} />
          <Route path="/teacher/exams" element={<ExamsPage />} />
          <Route path="/teacher/announcements" element={<AnnouncementsPage />} />
          <Route path="/teacher/notifications" element={<NotificationsPage />} />
          <Route path="/teacher/profile" element={<TeacherProfilePage />} />
          <Route path="/teacher/appearance" element={<AppearancePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["STUDENT"]} />}>
        <Route element={<DashboardLayout role="STUDENT" />}>
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/live-classes" element={<StudentLiveClassesPage />} />
          <Route path="/student/live-classes/:liveClassId/room" element={<LiveClassRoomPage />} />
          <Route path="/student/security" element={<SecuritySettingsPage />} />
          <Route path="/student/courses" element={<StudentCoursesPage />} />
          <Route path="/student/courses/:courseId" element={<StudentCourseDetailPage />} />
          <Route path="/student/lessons/:lessonId" element={<StudentLessonDetailPage />} />
          <Route path="/student/videos" element={<StudentVideosPage />} />
          <Route path="/student/homework" element={<StudentHomeworkPage />} />
          <Route path="/student/exams" element={<StudentExamsPage />} />
          <Route path="/student/materials" element={<StudentMaterialsPage />} />
          <Route path="/student/results" element={<StudentResultsPage />} />
          <Route path="/student/ai" element={<StudentAiAssistantPage />} />
          <Route path="/student/announcements" element={<StudentAnnouncementsPage />} />
          <Route path="/student/notifications" element={<NotificationsPage />} />
          <Route path="/student/profile" element={<StudentProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const toastStyle = {
  background: "var(--surface)",
  color: "var(--ink)",
  border: "1px solid var(--line)",
  borderRadius: "14px",
  boxShadow: "var(--sh-3)",
  fontFamily: "Cairo, sans-serif",
  fontSize: "14px",
  fontWeight: 600,
  padding: "10px 14px",
  maxWidth: "min(92vw, 420px)",
};

export default function App() {
  return (
    <ThemeProvider>
      <PlatformProvider>
        <AuthProvider>
          <ConfirmProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Toaster
                position="top-center"
                containerStyle={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
                toastOptions={{
                  duration: 3500,
                  style: toastStyle,
                  success: { iconTheme: { primary: "var(--ok-solid)", secondary: "var(--surface)" } },
                  error: { duration: 5000, iconTheme: { primary: "var(--bad-solid)", secondary: "var(--surface)" } },
                }}
              />
              <PwaExperience />
              <Suspense fallback={<div className="min-h-screen bg-surface p-6 max-w-page mx-auto"><LoadingState label="جارِ التحميل..." /></div>}>
                <AppRoutes />
              </Suspense>
            </BrowserRouter>
          </ConfirmProvider>
        </AuthProvider>
      </PlatformProvider>
    </ThemeProvider>
  );
}
