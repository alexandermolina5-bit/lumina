package cr.lumina.agenda;
import java.util.*;
public final class ReminderPlan {
    public static long[] futureLeads(long start,long now) {
        return java.util.stream.LongStream.of(172800000L,86400000L,3600000L,0L).filter(lead->start-lead>now).toArray();
    }
}
