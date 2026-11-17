package cr.lumina.agenda;
import static org.junit.Assert.*;
import org.junit.Test;
public class ReminderPlanTest {
 @Test public void distantAppointmentGetsFourReminders(){assertArrayEquals(new long[]{172800000L,86400000L,3600000L,0L},ReminderPlan.futureLeads(200000000L,0));}
 @Test public void appointmentWithinDayGetsHourAndStart(){assertArrayEquals(new long[]{3600000L,0L},ReminderPlan.futureLeads(7200000L,0));}
 @Test public void nearAppointmentStillGetsStartNotice(){assertArrayEquals(new long[]{0L},ReminderPlan.futureLeads(1800000L,0));}
 @Test public void pastAppointmentsNeverSchedule(){assertEquals(0,ReminderPlan.futureLeads(1000,2000).length);}
 @Test public void withinTwoDaysSkipsPastLead(){assertArrayEquals(new long[]{86400000L,3600000L,0L},ReminderPlan.futureLeads(100000000L,0));}
 @Test public void exactlyNowIsNotResent(){assertArrayEquals(new long[]{0L},ReminderPlan.futureLeads(3600000L,0));}
}
