package cr.lumina.agenda;
import java.util.Arrays;
public class ReminderPlanCheck {
 static void check(long[] expected,long[] actual){if(!Arrays.equals(expected,actual))throw new AssertionError(Arrays.toString(actual));}
 public static void main(String[] args){
 check(new long[]{172800000L,86400000L,3600000L,0L},ReminderPlan.futureLeads(200000000L,0));
 check(new long[]{86400000L,3600000L,0L},ReminderPlan.futureLeads(100000000L,0));
 check(new long[]{3600000L,0L},ReminderPlan.futureLeads(7200000L,0));
 check(new long[]{0L},ReminderPlan.futureLeads(1800000L,0));
 check(new long[]{},ReminderPlan.futureLeads(1000,2000));
 check(new long[]{0L},ReminderPlan.futureLeads(3600000L,0));
 System.out.println("PASS: 48h, 24h, 1h, start; past/equal deadlines excluded.");
 }
}
